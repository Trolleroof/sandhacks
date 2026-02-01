// ---------------------------------------------------------------------------
// cloud_web_bridge_node
//
// Subscribes to RTAB-Map outputs, applies an (optional, configurable)
// filtering pipeline, rate-limits, and re-publishes as JSON strings on
// web-facing topics consumed by rosbridge → Three.js.
//
// Subscriptions          → Publications
//   /cloud_map           → /web/pointcloud   (Base64-encoded PointCloud2)
//   /odom                → /web/pose         (position + quaternion)
//   /mapPath             → /web/path         (array of positions)
//   /spatial_detections  → /web/objects      (world-frame object detections)
// ---------------------------------------------------------------------------

#include <chrono>
#include <cstdio>
#include <cstdint>
#include <iomanip>
#include <sstream>
#include <string>
#include <vector>
#include <unordered_map>
#include <mutex>
#include <cmath>

#include <nav_msgs/msg/odometry.hpp>
#include <nav_msgs/msg/path.hpp>
#include <rclcpp/rclcpp.hpp>
#include <sensor_msgs/msg/point_cloud2.hpp>
#include <std_msgs/msg/string.hpp>
#include <std_msgs/msg/empty.hpp>
#include <depth_mapping/msg/spatial_detection_array.hpp>
#include <geometry_msgs/msg/pose.hpp>
#include <geometry_msgs/msg/quaternion.hpp>

// ===========================================================================
// Inline base64 encoder  (avoids an external dependency for a small utility)
// ===========================================================================
namespace {

constexpr const char* kB64 =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "0123456789+/";

std::string base64_encode(const std::vector<uint8_t>& data)
{
  std::string out;
  out.reserve(((data.size() + 2) / 3) * 4);

  size_t i = 0;
  while (i + 2 < data.size()) {
    uint32_t n = (static_cast<uint32_t>(data[i]) << 16)
               | (static_cast<uint32_t>(data[i + 1]) << 8)
               | static_cast<uint32_t>(data[i + 2]);
    out += kB64[(n >> 18) & 0x3F];
    out += kB64[(n >> 12) & 0x3F];
    out += kB64[(n >> 6) & 0x3F];
    out += kB64[n & 0x3F];
    i += 3;
  }

  size_t remaining = data.size() - i;
  if (remaining == 2) {
    uint32_t n = (static_cast<uint32_t>(data[i]) << 16)
               | (static_cast<uint32_t>(data[i + 1]) << 8);
    out += kB64[(n >> 18) & 0x3F];
    out += kB64[(n >> 12) & 0x3F];
    out += kB64[(n >> 6) & 0x3F];
    out += '=';
  } else if (remaining == 1) {
    uint32_t n = static_cast<uint32_t>(data[i]) << 16;
    out += kB64[(n >> 18) & 0x3F];
    out += kB64[(n >> 12) & 0x3F];
    out += '=';
    out += '=';
  }

  return out;
}

}  // anonymous namespace

// ===========================================================================
// World-frame object detection structure
// ===========================================================================
struct WorldObject {
  std::string id;
  std::string name;
  double x, y, z;
  double confidence;           // Published confidence (will be confidence_max)
  std::string timestamp;       // ISO timestamp string

  // Tracking fields
  rclcpp::Time last_seen;
  rclcpp::Time first_seen;
  uint32_t detection_count;
  double confidence_max;
  double confidence_sum;       // For computing average if needed
};

// ===========================================================================
// Node
// ===========================================================================
class CloudWebBridgeNode : public rclcpp::Node
{
public:
  explicit CloudWebBridgeNode() : rclcpp::Node("cloud_web_bridge_node")
  {
    // ---- declare parameters ------------------------------------------------
    declare_parameter("enable_voxel", false);
    declare_parameter("enable_passthrough", false);
    declare_parameter("enable_outlier", false);
    declare_parameter("publish_rate_hz", 2.0);
    declare_parameter("path_publish_rate_hz", 1.0);
    declare_parameter("voxel_size", 0.05);
    declare_parameter("passthrough_min_z", -1.0);
    declare_parameter("passthrough_max_z", 3.0);
    declare_parameter("outlier_mean_k", 50);
    declare_parameter("outlier_stddev_thresh", 1.0);
    declare_parameter("proximity_threshold", 3.0);
    declare_parameter("movement_threshold", 0.5);
    declare_parameter("enable_deduplication", true);
    declare_parameter("min_confidence", 0.85);
    declare_parameter("min_detections_to_publish", 3);
    declare_parameter("update_debounce_seconds", 1.0);
    declare_parameter("max_tracked_objects", 100);
    declare_parameter("single_detection_timeout_seconds", 5.0);

    loadParameters();

    // ---- subscriptions -----------------------------------------------------
    cloud_map_sub_ = create_subscription<sensor_msgs::msg::PointCloud2>(
        "/cloud_map", rclcpp::QoS(10),
        [this](const sensor_msgs::msg::PointCloud2& msg) { onCloudMap(msg); });

    odom_sub_ = create_subscription<nav_msgs::msg::Odometry>(
        "/odom", rclcpp::QoS(10),
        [this](const nav_msgs::msg::Odometry& msg) { onOdom(msg); });

    path_sub_ = create_subscription<nav_msgs::msg::Path>(
        "/mapPath", rclcpp::QoS(10),
        [this](const nav_msgs::msg::Path& msg) { onPath(msg); });

    spatial_detections_sub_ = create_subscription<depth_mapping::msg::SpatialDetectionArray>(
        "/spatial_detections", rclcpp::QoS(10),
        [this](const depth_mapping::msg::SpatialDetectionArray& msg) { onSpatialDetections(msg); });

    reset_objects_sub_ = create_subscription<std_msgs::msg::Empty>(
        "/web/reset_objects", rclcpp::QoS(10),
        [this](const std_msgs::msg::Empty&) { onResetObjects(); });

    // ---- publishers --------------------------------------------------------
    cloud_pub_ =
        create_publisher<std_msgs::msg::String>("/web/pointcloud", rclcpp::QoS(1));
    cloud_timer_ = rclcpp::create_timer(
        this,
        get_clock(),
        std::chrono::milliseconds(
            static_cast<int>(1000.0 / publish_rate_hz_)),
        [this]() { onCloudTimer(); });
    pose_pub_ =
        create_publisher<std_msgs::msg::String>("/web/pose", rclcpp::QoS(1));
    path_pub_ =
        create_publisher<std_msgs::msg::String>("/web/path", rclcpp::QoS(1));
    objects_pub_ =
        create_publisher<std_msgs::msg::String>("/web/objects", rclcpp::QoS(1));

    RCLCPP_INFO(get_logger(), "cloud_web_bridge_node started");
    RCLCPP_INFO(get_logger(), "  publish_rate_hz      : %.1f", publish_rate_hz_);
    RCLCPP_INFO(
        get_logger(), "  path_publish_rate_hz : %.1f", path_publish_rate_hz_);
    RCLCPP_INFO(
        get_logger(),
        "  filters — voxel:%d  passthrough:%d  outlier:%d",
        static_cast<int>(enable_voxel_),
        static_cast<int>(enable_passthrough_),
        static_cast<int>(enable_outlier_));
    if (enable_deduplication_) {
      RCLCPP_INFO(get_logger(), "  deduplication — proximity:%.2fm  movement:%.2fm  min_conf:%.0f%%  min_detections:%u",
                  proximity_threshold_, movement_threshold_, min_confidence_ * 100.0, min_detections_to_publish_);
    }
  }

private:
  // --- runtime config -------------------------------------------------------
  bool enable_voxel_;
  bool enable_passthrough_;
  bool enable_outlier_;
  double publish_rate_hz_;
  double path_publish_rate_hz_;
  double voxel_size_;
  double passthrough_min_z_;
  double passthrough_max_z_;
  int outlier_mean_k_;
  double outlier_stddev_thresh_;
  bool enable_deduplication_;
  double proximity_threshold_;
  double movement_threshold_;
  double min_confidence_;
  uint32_t min_detections_to_publish_;
  double update_debounce_seconds_;
  uint32_t max_tracked_objects_;
  double single_detection_timeout_seconds_;

  // --- rate-limit bookkeeping (steady_clock avoids ROS clock-type mismatches)
  using Clock  = std::chrono::steady_clock;
  using TimePt = Clock::time_point;

  TimePt last_pose_pub_  {};
  TimePt last_path_pub_  {};
  size_t last_path_len_  = 0;

  // --- ROS handles ----------------------------------------------------------
  rclcpp::Subscription<sensor_msgs::msg::PointCloud2>::SharedPtr cloud_map_sub_;
  rclcpp::Subscription<nav_msgs::msg::Odometry>::SharedPtr odom_sub_;
  rclcpp::Subscription<nav_msgs::msg::Path>::SharedPtr path_sub_;
  rclcpp::Subscription<depth_mapping::msg::SpatialDetectionArray>::SharedPtr spatial_detections_sub_;
  rclcpp::Subscription<std_msgs::msg::Empty>::SharedPtr reset_objects_sub_;

  // Buffered latest cloud_map message (nullptr = not yet received)
  std::shared_ptr<sensor_msgs::msg::PointCloud2> cloud_map_latest_;
  bool        cloud_dirty_     = false;
  std::string last_cloud_json_;
  rclcpp::TimerBase::SharedPtr cloud_timer_;

  rclcpp::Publisher<std_msgs::msg::String>::SharedPtr cloud_pub_;
  rclcpp::Publisher<std_msgs::msg::String>::SharedPtr pose_pub_;
  rclcpp::Publisher<std_msgs::msg::String>::SharedPtr path_pub_;
  rclcpp::Publisher<std_msgs::msg::String>::SharedPtr objects_pub_;

  // --- spatial detections tracking ------------------------------------------
  std::mutex camera_pose_mutex_;
  geometry_msgs::msg::Pose latest_camera_pose_;
  bool camera_pose_ready_ = false;

  std::mutex objects_mutex_;
  std::unordered_map<std::string, WorldObject> world_objects_;
  uint64_t next_object_id_ = 0;

  // ==========================================================================
  // Helpers
  // ==========================================================================
  void loadParameters()
  {
    enable_voxel_          = get_parameter("enable_voxel").as_bool();
    enable_passthrough_    = get_parameter("enable_passthrough").as_bool();
    enable_outlier_        = get_parameter("enable_outlier").as_bool();
    publish_rate_hz_       = get_parameter("publish_rate_hz").as_double();
    path_publish_rate_hz_  = get_parameter("path_publish_rate_hz").as_double();
    voxel_size_            = get_parameter("voxel_size").as_double();
    passthrough_min_z_     = get_parameter("passthrough_min_z").as_double();
    passthrough_max_z_     = get_parameter("passthrough_max_z").as_double();
    outlier_mean_k_        = get_parameter("outlier_mean_k").as_int();
    outlier_stddev_thresh_ = get_parameter("outlier_stddev_thresh").as_double();
    enable_deduplication_  = get_parameter("enable_deduplication").as_bool();
    proximity_threshold_   = get_parameter("proximity_threshold").as_double();
    movement_threshold_    = get_parameter("movement_threshold").as_double();
    min_confidence_        = get_parameter("min_confidence").as_double();
    min_detections_to_publish_ = get_parameter("min_detections_to_publish").as_int();
    update_debounce_seconds_ = get_parameter("update_debounce_seconds").as_double();
    max_tracked_objects_   = get_parameter("max_tracked_objects").as_int();
    single_detection_timeout_seconds_ = get_parameter("single_detection_timeout_seconds").as_double();
  }

  bool shouldPublish(TimePt last, double rate_hz) const
  {
    double dt = std::chrono::duration<double>(Clock::now() - last).count();
    return dt >= (1.0 / rate_hz);
  }

  static double stampToDouble(const builtin_interfaces::msg::Time& stamp)
  {
    return static_cast<double>(stamp.sec)
         + static_cast<double>(stamp.nanosec) / 1e9;
  }

  // ==========================================================================
  // Callbacks
  // ==========================================================================

  // --- point cloud ----------------------------------------------------------
  void onCloudMap(const sensor_msgs::msg::PointCloud2& cloud)
  {
    cloud_map_latest_ = std::make_shared<sensor_msgs::msg::PointCloud2>(cloud);
    cloud_dirty_      = true;
  }

  // Timer fires at publish_rate_hz.  Re-encodes only when new data has arrived;
  // always re-publishes the cached JSON so that a late-joining subscriber (e.g.
  // a restarted frontend via rosbridge) receives the full current map within one
  // tick.
  void onCloudTimer()
  {
    if (cloud_dirty_ && cloud_map_latest_) {
      sensor_msgs::msg::PointCloud2 cloud = *cloud_map_latest_;

      if (enable_voxel_)       cloud = applyVoxelGrid(cloud);
      if (enable_passthrough_) cloud = applyPassThrough(cloud);
      if (enable_outlier_)     cloud = applyOutlierRemoval(cloud);

      flipZ(cloud);
      last_cloud_json_ = encodePointCloud(cloud);
      cloud_dirty_     = false;
    }

    if (!last_cloud_json_.empty()) {
      std_msgs::msg::String msg;
      msg.data = last_cloud_json_;
      cloud_pub_->publish(msg);
    }
  }

  // --- pose -----------------------------------------------------------------
  void onOdom(const nav_msgs::msg::Odometry& odom)
  {
    // Store latest camera pose for spatial detection transforms
    {
      std::lock_guard<std::mutex> lock(camera_pose_mutex_);
      latest_camera_pose_ = odom.pose.pose;
      camera_pose_ready_ = true;
    }

    if (!shouldPublish(last_pose_pub_, publish_rate_hz_)) return;

    const auto& p  = odom.pose.pose.position;
    const auto& q  = odom.pose.pose.orientation;
    double      ts = stampToDouble(odom.header.stamp);

    char buf[512];
    std::snprintf(
        buf,
        sizeof(buf),
        R"({"timestamp":%.6f,"position":{"x":%.6f,"y":%.6f,"z":%.6f},"orientation":{"x":%.6f,"y":%.6f,"z":%.6f,"w":%.6f}})",
        ts,
        p.x,
        p.y,
        p.z,
        q.x,
        q.y,
        q.z,
        q.w);

    std_msgs::msg::String msg;
    msg.data = buf;
    pose_pub_->publish(msg);

    last_pose_pub_ = Clock::now();
  }

  // --- path -----------------------------------------------------------------
  // Only publishes when the path length changes (new keyframe / loop closure).
  // If rate-limited, last_path_len_ stays stale so the next incoming message
  // with the same new length will retry automatically.
  void onPath(const nav_msgs::msg::Path& path)
  {
    if (path.poses.size() == last_path_len_) return;
    if (!shouldPublish(last_path_pub_, path_publish_rate_hz_)) return;

    std::ostringstream oss;
    oss << "{\"frame_id\":\"" << path.header.frame_id << "\",\"poses\":[";

    for (size_t i = 0; i < path.poses.size(); ++i) {
      if (i > 0) oss << ',';
      const auto& pt = path.poses[i].pose.position;
      char buf[128];
      std::snprintf(
          buf, sizeof(buf), "{\"x\":%.6f,\"y\":%.6f,\"z\":%.6f}", pt.x, pt.y, pt.z);
      oss << buf;
    }
    oss << "]}";

    std_msgs::msg::String msg;
    msg.data = oss.str();
    path_pub_->publish(msg);

    last_path_len_ = path.poses.size();
    last_path_pub_ = Clock::now();
  }

  // --- spatial detections ---------------------------------------------------
  void onSpatialDetections(const depth_mapping::msg::SpatialDetectionArray& detections)
  {
    if (!camera_pose_ready_) {
      RCLCPP_WARN_THROTTLE(
          get_logger(),
          *get_clock(),
          5000,
          "No camera pose available yet, skipping spatial detections.");
      return;
    }

    geometry_msgs::msg::Pose camera_pose;
    {
      std::lock_guard<std::mutex> lock(camera_pose_mutex_);
      camera_pose = latest_camera_pose_;
    }

    double timestamp = stampToDouble(detections.header.stamp);

    std::lock_guard<std::mutex> lock(objects_mutex_);

    // Only clear if deduplication is disabled (backward compatibility)
    if (!enable_deduplication_) {
      world_objects_.clear();
    }

    for (const auto& det : detections.detections) {
      // Skip low-confidence detections when deduplication is enabled
      if (enable_deduplication_ && det.confidence < min_confidence_) {
        continue;
      }

      // Transform from camera frame to world frame
      auto world_pos = transformToWorldFrame(
          det.pose_camera.position,
          camera_pose);

      if (enable_deduplication_) {
        // Try to find existing object nearby with same class
        std::string matching_id = findMatchingObject(
            det.class_name,
            world_pos.x, world_pos.y, world_pos.z);

        if (!matching_id.empty()) {
          // Update existing object
          updateExistingObject(
              matching_id,
              world_pos.x, world_pos.y, world_pos.z,
              det.confidence,
              detections.header.stamp);
        } else {
          // Check if we've hit the maximum object limit
          if (world_objects_.size() < max_tracked_objects_) {
            // Create new object
            createNewObject(
                det.class_name,
                world_pos.x, world_pos.y, world_pos.z,
                det.confidence,
                detections.header.stamp);
          } else {
            RCLCPP_WARN_THROTTLE(
                get_logger(),
                *get_clock(),
                10000,
                "Max tracked objects limit (%u) reached, ignoring new detections",
                max_tracked_objects_);
          }
        }
      } else {
        // OLD BEHAVIOR: Always create new object
        std::ostringstream id_stream;
        id_stream << "obj_" << std::setfill('0') << std::setw(6) << next_object_id_++;

        WorldObject obj;
        obj.id = id_stream.str();
        obj.name = det.class_name;
        obj.x = world_pos.x;
        obj.y = world_pos.y;
        obj.z = world_pos.z;
        obj.confidence = det.confidence;

        std::ostringstream ts_stream;
        ts_stream << std::fixed << std::setprecision(6) << timestamp;
        obj.timestamp = ts_stream.str();

        // Initialize tracking fields for consistency
        obj.first_seen = detections.header.stamp;
        obj.last_seen = detections.header.stamp;
        obj.detection_count = 1;
        obj.confidence_max = det.confidence;
        obj.confidence_sum = det.confidence;

        world_objects_[obj.id] = obj;
      }
    }

    // Cleanup: Remove single-detection objects that have timed out (likely spam)
    if (enable_deduplication_) {
      rclcpp::Time now = detections.header.stamp;
      std::vector<std::string> objects_to_remove;

      for (const auto& [id, obj] : world_objects_) {
        // If object only detected once and timeout has passed, mark for removal
        if (obj.detection_count == 1) {
          double age = (now - obj.first_seen).seconds();
          if (age > single_detection_timeout_seconds_) {
            objects_to_remove.push_back(id);
          }
        }
      }

      // Remove spam objects
      for (const auto& id : objects_to_remove) {
        world_objects_.erase(id);
      }

      if (!objects_to_remove.empty()) {
        RCLCPP_INFO(get_logger(), "Removed %zu unconfirmed single-detection spam objects",
                    objects_to_remove.size());
      }
    }

    // Publish updated objects list
    publishObjects();
  }

  // Transform a point from camera frame to world frame using camera pose
  geometry_msgs::msg::Point transformToWorldFrame(
      const geometry_msgs::msg::Point& camera_point,
      const geometry_msgs::msg::Pose& camera_pose)
  {
    // Extract quaternion components
    double qw = camera_pose.orientation.w;
    double qx = camera_pose.orientation.x;
    double qy = camera_pose.orientation.y;
    double qz = camera_pose.orientation.z;

    // Convert quaternion to rotation matrix
    double r11 = 1.0 - 2.0 * (qy * qy + qz * qz);
    double r12 = 2.0 * (qx * qy - qw * qz);
    double r13 = 2.0 * (qx * qz + qw * qy);

    double r21 = 2.0 * (qx * qy + qw * qz);
    double r22 = 1.0 - 2.0 * (qx * qx + qz * qz);
    double r23 = 2.0 * (qy * qz - qw * qx);

    double r31 = 2.0 * (qx * qz - qw * qy);
    double r32 = 2.0 * (qy * qz + qw * qx);
    double r33 = 1.0 - 2.0 * (qx * qx + qy * qy);

    // Apply rotation and translation
    geometry_msgs::msg::Point world_point;
    world_point.x = r11 * camera_point.x + r12 * camera_point.y + r13 * camera_point.z + camera_pose.position.x;
    world_point.y = r21 * camera_point.x + r22 * camera_point.y + r23 * camera_point.z + camera_pose.position.y;
    world_point.z = r31 * camera_point.x + r32 * camera_point.y + r33 * camera_point.z + camera_pose.position.z;

    return world_point;
  }

  // Calculate Euclidean distance between two 3D points
  double calculateDistance(double x1, double y1, double z1,
                          double x2, double y2, double z2) const
  {
    double dx = x2 - x1;
    double dy = y2 - y1;
    double dz = z2 - z1;
    return std::sqrt(dx*dx + dy*dy + dz*dz);
  }

  // Find existing object matching class and proximity
  // Returns object ID if match found, empty string otherwise
  // Must be called with objects_mutex_ already locked
  std::string findMatchingObject(const std::string& class_name,
                                 double x, double y, double z)
  {
    double min_distance = std::numeric_limits<double>::max();
    std::string best_match_id;

    for (const auto& [id, obj] : world_objects_) {
      if (obj.name != class_name) continue;

      double dist = calculateDistance(x, y, z, obj.x, obj.y, obj.z);

      if (dist < proximity_threshold_ && dist < min_distance) {
        min_distance = dist;
        best_match_id = id;
      }
    }

    return best_match_id;
  }

  // Update existing object with new detection
  // Must be called with objects_mutex_ already locked
  void updateExistingObject(const std::string& obj_id,
                           double new_x, double new_y, double new_z,
                           double new_confidence,
                           const rclcpp::Time& timestamp)
  {
    auto it = world_objects_.find(obj_id);
    if (it == world_objects_.end()) return;

    WorldObject& obj = it->second;

    // Check debounce time - prevent rapid updates
    double time_since_last_update = (timestamp - obj.last_seen).seconds();
    bool debounce_passed = time_since_last_update >= update_debounce_seconds_;

    // Only update position if movement exceeds threshold AND debounce passed
    double movement_dist = calculateDistance(
        obj.x, obj.y, obj.z, new_x, new_y, new_z);

    if (movement_dist >= movement_threshold_ && debounce_passed) {
      obj.x = new_x;
      obj.y = new_y;
      obj.z = new_z;
    }

    // Update tracking metadata
    obj.last_seen = timestamp;
    obj.detection_count++;
    obj.confidence_sum += new_confidence;
    obj.confidence_max = std::max(obj.confidence_max, new_confidence);
    obj.confidence = obj.confidence_max;

    // Update timestamp string only if debounce passed
    if (debounce_passed) {
      std::ostringstream ts_stream;
      ts_stream << std::fixed << std::setprecision(6) << timestamp.seconds();
      obj.timestamp = ts_stream.str();
    }
  }

  // Create new object and add to map
  // Must be called with objects_mutex_ already locked
  std::string createNewObject(const std::string& class_name,
                             double x, double y, double z,
                             double confidence,
                             const rclcpp::Time& timestamp)
  {
    // Generate unique ID
    std::ostringstream id_stream;
    id_stream << "obj_" << std::setfill('0') << std::setw(6) << next_object_id_++;
    std::string obj_id = id_stream.str();

    WorldObject obj;
    obj.id = obj_id;
    obj.name = class_name;
    obj.x = x;
    obj.y = y;
    obj.z = z;
    obj.confidence = confidence;

    // Initialize tracking metadata
    obj.first_seen = timestamp;
    obj.last_seen = timestamp;
    obj.detection_count = 1;
    obj.confidence_max = confidence;
    obj.confidence_sum = confidence;

    // Timestamp string
    std::ostringstream ts_stream;
    ts_stream << std::fixed << std::setprecision(6) << timestamp.seconds();
    obj.timestamp = ts_stream.str();

    world_objects_[obj_id] = obj;

    return obj_id;
  }

  // Publish world-frame objects as JSON
  void publishObjects()
  {
    std::ostringstream oss;
    oss << "{\"objects\":[";

    bool first = true;
    for (const auto& [id, obj] : world_objects_) {
      // Only publish objects that meet minimum detection count threshold
      if (enable_deduplication_ && obj.detection_count < min_detections_to_publish_) {
        continue;
      }

      if (!first) oss << ",";
      first = false;

      oss << "{\"id\":\"" << obj.id << "\""
          << ",\"name\":\"" << obj.name << "\""
          << ",\"position\":{\"x\":" << std::fixed << std::setprecision(6) << obj.x
          << ",\"y\":" << obj.y
          << ",\"z\":" << obj.z << "}"
          << ",\"confidence\":" << std::setprecision(2) << obj.confidence
          << ",\"timestamp\":\"" << obj.timestamp << "\"}";
    }

    oss << "]}";

    std_msgs::msg::String msg;
    msg.data = oss.str();
    objects_pub_->publish(msg);
  }

  void onResetObjects()
  {
    std::lock_guard<std::mutex> lock(objects_mutex_);
    size_t count = world_objects_.size();
    world_objects_.clear();
    next_object_id_ = 0;
    RCLCPP_INFO(get_logger(), "Reset objects map (removed %zu objects)", count);
    publishObjects();  // Publish empty object list
  }

  // ==========================================================================
  // Flip the point cloud vertically (negate every Z value in the binary buffer).
  //
  // PointCloud2 stores points as a flat byte array.  Each point occupies
  // `point_step` bytes starting at offset `i * point_step`.  The Z field sits
  // at a fixed byte offset within that stride (given by fields[].offset) and
  // is stored as a little-endian float32.  We reinterpret the relevant bytes
  // as a float, negate it, and write it back.  This is equivalent to a
  // reflection across the XY-plane:  (x, y, z) → (x, y, −z).
  // ==========================================================================
  static void flipZ(sensor_msgs::msg::PointCloud2& cloud)
  {
    // Locate the "z" field descriptor.
    uint32_t z_offset   = 0;
    bool     found_z    = false;
    for (const auto& f : cloud.fields) {
      if (f.name == "z") {
        z_offset = f.offset;
        found_z  = true;
        break;
      }
    }
    if (!found_z) return;

    const uint32_t stride     = cloud.point_step;
    const size_t   num_points = static_cast<size_t>(cloud.width)
                              * static_cast<size_t>(cloud.height);

    for (size_t i = 0; i < num_points; ++i) {
      float* z = reinterpret_cast<float*>(
          &cloud.data[i * stride + z_offset]);
      *z = -(*z);
    }
  }

  // ==========================================================================
  // Encoding
  // ==========================================================================
  std::string encodePointCloud(const sensor_msgs::msg::PointCloud2& cloud) const
  {
    std::string b64 = base64_encode(cloud.data);

    // Field descriptor array
    std::string fields = "[";
    for (size_t i = 0; i < cloud.fields.size(); ++i) {
      if (i > 0) fields += ',';
      char tmp[256];
      std::snprintf(
          tmp,
          sizeof(tmp),
          "{\"name\":\"%s\",\"offset\":%u,\"datatype\":%d,\"count\":%u}",
          cloud.fields[i].name.c_str(),
          cloud.fields[i].offset,
          static_cast<int>(cloud.fields[i].datatype),
          cloud.fields[i].count);
      fields += tmp;
    }
    fields += ']';

    // Final JSON envelope
    std::ostringstream oss;
    oss << "{\"frame_id\":\"" << cloud.header.frame_id << "\""
        << ",\"width\":" << cloud.width << ",\"height\":" << cloud.height
        << ",\"point_step\":" << cloud.point_step
        << ",\"row_step\":" << cloud.row_step
        << ",\"is_dense\":" << (cloud.is_dense ? "true" : "false")
        << ",\"fields\":" << fields << ",\"points_b64\":\"" << b64 << "\""
        << "}";

    return oss.str();
  }

  // ==========================================================================
  // Filter stubs  —  all disabled by default; enable via params.yaml.
  //                  Replace bodies when PCL or equivalent is wired in.
  // ==========================================================================
  sensor_msgs::msg::PointCloud2
  applyVoxelGrid(const sensor_msgs::msg::PointCloud2& cloud)
  {
    RCLCPP_WARN_THROTTLE(
        get_logger(),
        *get_clock(),
        5000,
        "Voxel filter enabled but not yet implemented — passing through.");
    return cloud;
  }

  sensor_msgs::msg::PointCloud2
  applyPassThrough(const sensor_msgs::msg::PointCloud2& cloud)
  {
    RCLCPP_WARN_THROTTLE(
        get_logger(),
        *get_clock(),
        5000,
        "Passthrough filter enabled but not yet implemented — passing through.");
    return cloud;
  }

  sensor_msgs::msg::PointCloud2
  applyOutlierRemoval(const sensor_msgs::msg::PointCloud2& cloud)
  {
    RCLCPP_WARN_THROTTLE(
        get_logger(),
        *get_clock(),
        5000,
        "Outlier removal enabled but not yet implemented — passing through.");
    return cloud;
  }
};

// ===========================================================================
// main
// ===========================================================================
int main(int argc, char* argv[])
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<CloudWebBridgeNode>());
  rclcpp::shutdown();
  return 0;
}
