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
// ---------------------------------------------------------------------------

#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdint>
#include <sstream>
#include <string>
#include <unordered_map>
#include <vector>

#include <nav_msgs/msg/odometry.hpp>
#include <nav_msgs/msg/path.hpp>
#include <rclcpp/rclcpp.hpp>
#include <sensor_msgs/msg/point_cloud2.hpp>
#include <std_msgs/msg/string.hpp>

#include "json.hpp"

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

// ===========================================================================
// Quaternion rotation helper
// ===========================================================================
static void rotateByQuaternion(
    double qx, double qy, double qz, double qw,
    double vx, double vy, double vz,
    double& ox, double& oy, double& oz)
{
  // q * v * q_conjugate, expanded:
  // t = 2 * cross(q_xyz, v)
  double tx = 2.0 * (qy * vz - qz * vy);
  double ty = 2.0 * (qz * vx - qx * vz);
  double tz = 2.0 * (qx * vy - qy * vx);
  // result = v + qw * t + cross(q_xyz, t)
  ox = vx + qw * tx + (qy * tz - qz * ty);
  oy = vy + qw * ty + (qz * tx - qx * tz);
  oz = vz + qw * tz + (qx * ty - qy * tx);
}

// ===========================================================================
// Tracked detection data structure
// ===========================================================================
struct TrackedDetection {
  std::string id;
  std::string name;
  double confidence;
  double wx, wy, wz;      // world-frame position (meters, Z-flipped)
  double timestamp;        // ROS time as double
  int hit_count;
};

}  // anonymous namespace

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
    declare_parameter("detection_publish_rate_hz", 2.0);
    declare_parameter("detection_merge_radius_m", 0.5);
    declare_parameter("detection_ttl_s", 60.0);

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

    detection_sub_ = create_subscription<std_msgs::msg::String>(
        "/spatial_detection/detections", rclcpp::QoS(10),
        [this](const std_msgs::msg::String& msg) { onDetections(msg); });

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
    detection_timer_ = rclcpp::create_timer(
        this,
        get_clock(),
        std::chrono::milliseconds(
            static_cast<int>(1000.0 / detection_publish_rate_hz_)),
        [this]() { onDetectionTimer(); });

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

  // detection config
  double detection_publish_rate_hz_;
  double detection_merge_radius_m_;
  double detection_ttl_s_;

  // --- rate-limit bookkeeping (steady_clock avoids ROS clock-type mismatches)
  using Clock  = std::chrono::steady_clock;
  using TimePt = Clock::time_point;

  TimePt last_pose_pub_  {};
  TimePt last_path_pub_  {};
  size_t last_path_len_  = 0;

  // --- cached pose for coordinate transformation ----------------------------
  double latest_px_ = 0, latest_py_ = 0, latest_pz_ = 0;
  double latest_qx_ = 0, latest_qy_ = 0, latest_qz_ = 0, latest_qw_ = 1;
  bool   pose_valid_ = false;

  // --- tracked detections ---------------------------------------------------
  std::unordered_map<std::string, TrackedDetection> tracked_objects_;
  uint64_t id_counter_ = 0;

  // --- ROS handles ----------------------------------------------------------
  rclcpp::Subscription<sensor_msgs::msg::PointCloud2>::SharedPtr cloud_map_sub_;
  rclcpp::Subscription<nav_msgs::msg::Odometry>::SharedPtr odom_sub_;
  rclcpp::Subscription<nav_msgs::msg::Path>::SharedPtr path_sub_;

  // Buffered latest cloud_map message (nullptr = not yet received)
  std::shared_ptr<sensor_msgs::msg::PointCloud2> cloud_map_latest_;
  bool        cloud_dirty_     = false;
  std::string last_cloud_json_;
  rclcpp::TimerBase::SharedPtr cloud_timer_;

  rclcpp::Publisher<std_msgs::msg::String>::SharedPtr cloud_pub_;
  rclcpp::Publisher<std_msgs::msg::String>::SharedPtr pose_pub_;
  rclcpp::Publisher<std_msgs::msg::String>::SharedPtr path_pub_;

  // detection handles
  rclcpp::Subscription<std_msgs::msg::String>::SharedPtr detection_sub_;
  rclcpp::Publisher<std_msgs::msg::String>::SharedPtr objects_pub_;
  rclcpp::TimerBase::SharedPtr detection_timer_;

  // ==========================================================================
  // Helpers
  // ==========================================================================
  void loadParameters()
  {
    enable_voxel_               = get_parameter("enable_voxel").as_bool();
    enable_passthrough_         = get_parameter("enable_passthrough").as_bool();
    enable_outlier_             = get_parameter("enable_outlier").as_bool();
    publish_rate_hz_            = get_parameter("publish_rate_hz").as_double();
    path_publish_rate_hz_       = get_parameter("path_publish_rate_hz").as_double();
    voxel_size_                 = get_parameter("voxel_size").as_double();
    passthrough_min_z_          = get_parameter("passthrough_min_z").as_double();
    passthrough_max_z_          = get_parameter("passthrough_max_z").as_double();
    outlier_mean_k_             = get_parameter("outlier_mean_k").as_int();
    outlier_stddev_thresh_      = get_parameter("outlier_stddev_thresh").as_double();
    detection_publish_rate_hz_  = get_parameter("detection_publish_rate_hz").as_double();
    detection_merge_radius_m_   = get_parameter("detection_merge_radius_m").as_double();
    detection_ttl_s_            = get_parameter("detection_ttl_s").as_double();
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
    // Cache pose for detection coordinate transformation (before rate limiting)
    const auto& p = odom.pose.pose.position;
    const auto& q = odom.pose.pose.orientation;
    latest_px_ = p.x;  latest_py_ = p.y;  latest_pz_ = p.z;
    latest_qx_ = q.x;  latest_qy_ = q.y;  latest_qz_ = q.z;  latest_qw_ = q.w;
    pose_valid_ = true;

    if (!shouldPublish(last_pose_pub_, publish_rate_hz_)) return;

    double ts = stampToDouble(odom.header.stamp);

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

  // --- detections -----------------------------------------------------------
  void onDetections(const std_msgs::msg::String& msg)
  {
    if (!pose_valid_) return;  // no transform available yet

    double now = stampToDouble(get_clock()->now());

    try {
      // Parse JSON array from detection message
      nlohmann::json detections = nlohmann::json::parse(msg.data);
      if (!detections.is_array()) return;

      for (const auto& det : detections) {
        if (!det.contains("label") || !det.contains("confidence") || !det.contains("spatial")) {
          continue;
        }

        std::string label = det["label"];
        double confidence = det["confidence"];
        const auto& spatial = det["spatial"];

        if (!spatial.contains("x") || !spatial.contains("y") || !spatial.contains("z")) {
          continue;
        }

        // Convert mm -> meters
        double dx = spatial["x"].get<double>() / 1000.0;
        double dy = spatial["y"].get<double>() / 1000.0;
        double dz = spatial["z"].get<double>() / 1000.0;

        // Rotate by camera quaternion
        double rx, ry, rz;
        rotateByQuaternion(latest_qx_, latest_qy_, latest_qz_, latest_qw_,
                           dx, dy, dz, rx, ry, rz);

        // Translate to world frame
        double wx = latest_px_ + rx;
        double wy = latest_py_ + ry;
        double wz = latest_pz_ + rz;

        // Apply Z-flip to match point cloud convention
        wz = -wz;

        // Deduplication: find existing tracked object with same label within merge_radius
        std::string match_id = "";
        double best_dist = detection_merge_radius_m_;
        for (auto& [id, tracked] : tracked_objects_) {
          if (tracked.name != label) continue;
          double d = std::sqrt(
              std::pow(tracked.wx - wx, 2) +
              std::pow(tracked.wy - wy, 2) +
              std::pow(tracked.wz - wz, 2));
          if (d < best_dist) {
            best_dist = d;
            match_id = id;
          }
        }

        if (!match_id.empty()) {
          // Update existing: weighted average position for smoothing
          auto& t = tracked_objects_[match_id];
          double alpha = 0.3;  // smoothing factor
          t.wx = t.wx * (1.0 - alpha) + wx * alpha;
          t.wy = t.wy * (1.0 - alpha) + wy * alpha;
          t.wz = t.wz * (1.0 - alpha) + wz * alpha;
          t.confidence = std::max(t.confidence, confidence);
          t.timestamp = now;
          t.hit_count++;
        } else {
          // New object: generate ID
          std::string new_id = label + "_" + std::to_string(id_counter_++);
          tracked_objects_[new_id] = {
              new_id, label, confidence, wx, wy, wz, now, 1
          };
        }
      }
    } catch (const nlohmann::json::exception& e) {
      RCLCPP_WARN_THROTTLE(get_logger(), *get_clock(), 5000,
                           "Failed to parse detection JSON: %s", e.what());
    }
  }

  void onDetectionTimer()
  {
    double now_s = stampToDouble(get_clock()->now());

    // Evict stale detections
    for (auto it = tracked_objects_.begin(); it != tracked_objects_.end(); ) {
      if ((now_s - it->second.timestamp) > detection_ttl_s_) {
        it = tracked_objects_.erase(it);
      } else {
        ++it;
      }
    }

    // Build JSON object with objects array and cameraPosition
    nlohmann::json output;
    nlohmann::json objects_array = nlohmann::json::array();

    for (const auto& [id, det] : tracked_objects_) {
      // Convert timestamp to ISO 8601 string
      time_t t = static_cast<time_t>(det.timestamp);
      struct tm timeinfo;
      gmtime_r(&t, &timeinfo);
      char iso_timestamp[32];
      strftime(iso_timestamp, sizeof(iso_timestamp), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);

      nlohmann::json obj;
      obj["id"] = det.id;
      obj["name"] = det.name;
      obj["confidence"] = det.confidence;
      obj["position"] = {
          {"x", det.wx},
          {"y", det.wy},
          {"z", det.wz}
      };
      obj["timestamp"] = iso_timestamp;
      objects_array.push_back(obj);
    }

    output["objects"] = objects_array;
    output["cameraPosition"] = {
        {"x", latest_px_},
        {"y", latest_py_},
        {"z", -latest_pz_}  // Z-flip for camera position too
    };

    std_msgs::msg::String out;
    out.data = output.dump();
    objects_pub_->publish(out);
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
