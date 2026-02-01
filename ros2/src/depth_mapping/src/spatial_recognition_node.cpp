// ---------------------------------------------------------------------------
// spatial_recognition_node
//
// Pure RGB + stereo-depth spatial detection.  Runs YOLOv8 (ONNX) locally,
// associates each 2D bbox with median depth, and projects to 3D in the
// camera optical frame.
//
// Subscriptions
//   /color/image            sensor_msgs/Image       — RGB input
//   /color/camera_info      sensor_msgs/CameraInfo  — intrinsics (cached once)
//   /stereo/depth           sensor_msgs/Image       — mono16 depth in mm
//
// Publications
//   /spatial_detections         depth_mapping/SpatialDetectionArray
//   /spatial_detections_markers visualization_msgs/MarkerArray  (optional)
// ---------------------------------------------------------------------------

#include <atomic>
#include <condition_variable>
#include <deque>
#include <iomanip>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

#include <cv_bridge/cv_bridge.h>
#include <message_filters/approximate_time.h>
#include <message_filters/subscriber.h>
#include <message_filters/sync_policies/approximate_time.h>
#include <message_filters/synchronizer.h>
#include <opencv2/core.hpp>
#include <opencv2/imgproc.hpp>
#include <rclcpp/rclcpp.hpp>
#include <sensor_msgs/msg/camera_info.hpp>
#include <sensor_msgs/msg/image.hpp>
#include <visualization_msgs/msg/marker_array.hpp>

#include <onnxruntime_cxx_api.h>

#include <depth_mapping/msg/spatial_detection_array.hpp>

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

struct Detection2D {
  float x1, y1, x2, y2;
  float confidence;
  int   class_id;
};

struct SpatialResult {
  Detection2D bbox;
  double x, y, z;   // camera-frame position (m)
  double w, h;       // estimated physical size (m)
  bool   depth_valid;
};

// COCO 2017 — 80 classes (matches standard YOLOv8 export)
static const std::vector<std::string> COCO_LABELS = {
    "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train",
    "truck", "boat", "traffic light", "fire hydrant", "stop sign",
    "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep",
    "cow", "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella",
    "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard",
    "sports ball", "kite", "baseball bat", "baseball glove", "skateboard",
    "surfboard", "tennis racket", "bottle", "wine glass", "cup", "fork",
    "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
    "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair",
    "couch", "potted plant", "bed", "dining table", "toilet", "tv",
    "laptop", "mouse", "remote", "keyboard", "cell phone", "microwave",
    "oven", "toaster", "sink", "refrigerator", "book", "clock", "vase",
    "scissors", "teddy bear", "hair drier", "toothbrush"};

// ---------------------------------------------------------------------------
// Node
// ---------------------------------------------------------------------------

class SpatialRecognitionNode : public rclcpp::Node {
public:
  using ApproxSync = message_filters::sync_policies::ApproximateTime<
      sensor_msgs::msg::Image, sensor_msgs::msg::Image>;

  explicit SpatialRecognitionNode()
      : rclcpp::Node("spatial_recognition_node"),
        onnx_env_(ORT_LOGGING_LEVEL_WARNING, "SpatialRecognition")
  {
    // --- parameters --------------------------------------------------------
    declare_parameter("confidence_threshold", 0.4);
    declare_parameter("min_depth",            0.2);
    declare_parameter("max_depth",            6.0);
    declare_parameter("depth_method",         std::string("median"));
    declare_parameter("model_path",           std::string("/models/yolov8n.onnx"));
    declare_parameter("publish_markers",      true);
    declare_parameter("max_queue_size",       3);

    confidence_threshold_ = static_cast<float>(get_parameter("confidence_threshold").as_double());
    min_depth_            = static_cast<float>(get_parameter("min_depth").as_double());
    max_depth_            = static_cast<float>(get_parameter("max_depth").as_double());
    depth_method_         = get_parameter("depth_method").as_string();
    model_path_           = get_parameter("model_path").as_string();
    publish_markers_      = get_parameter("publish_markers").as_bool();
    max_queue_size_       = get_parameter("max_queue_size").as_int();

    // --- ONNX model --------------------------------------------------------
    loadModel();

    // --- subscribers -------------------------------------------------------
    color_sub_.subscribe(this, "/color/image");
    depth_sub_.subscribe(this, "/stereo/depth");

    sync_ = std::make_shared<message_filters::Synchronizer<ApproxSync>>(
        ApproxSync(10), color_sub_, depth_sub_);
    sync_->registerCallback(&SpatialRecognitionNode::onSync, this);

    camera_info_sub_ = create_subscription<sensor_msgs::msg::CameraInfo>(
        "/color/camera_info", rclcpp::QoS(10),
        &SpatialRecognitionNode::onCameraInfo, this);

    // --- publishers --------------------------------------------------------
    detections_pub_ = create_publisher<depth_mapping::msg::SpatialDetectionArray>(
        "/spatial_detections", rclcpp::QoS(4));
    if (publish_markers_) {
      markers_pub_ = create_publisher<visualization_msgs::msg::MarkerArray>(
          "/spatial_detections_markers", rclcpp::QoS(4));
    }

    // --- inference thread --------------------------------------------------
    inference_thread_ = std::thread(&SpatialRecognitionNode::inferenceLoop, this);

    RCLCPP_INFO(get_logger(), "spatial_recognition_node started");
    RCLCPP_INFO(get_logger(), "  model       : %s  (%dx%d)",
                model_path_.c_str(), model_input_w_, model_input_h_);
    RCLCPP_INFO(get_logger(), "  confidence  : %.2f", confidence_threshold_);
    RCLCPP_INFO(get_logger(), "  depth range : [%.2f, %.2f] m  method=%s",
                min_depth_, max_depth_, depth_method_.c_str());
  }

  ~SpatialRecognitionNode() {
    shutdown_.store(true);
    queue_cv_.notify_all();
    if (inference_thread_.joinable()) inference_thread_.join();
  }

private:
  // --- frame buffer --------------------------------------------------
  struct FramePair {
    cv::Mat     color;       // BGR uint8
    cv::Mat     depth;       // uint16 mm, resized to match color
    rclcpp::Time stamp;
    std::string  frame_id;
  };

  // === members ===============================================================

  float       confidence_threshold_;
  float       min_depth_, max_depth_;
  std::string depth_method_;
  std::string model_path_;
  bool        publish_markers_;
  int         max_queue_size_;

  message_filters::Subscriber<sensor_msgs::msg::Image> color_sub_;
  message_filters::Subscriber<sensor_msgs::msg::Image> depth_sub_;
  std::shared_ptr<message_filters::Synchronizer<ApproxSync>> sync_;
  rclcpp::Subscription<sensor_msgs::msg::CameraInfo>::SharedPtr camera_info_sub_;

  rclcpp::Publisher<depth_mapping::msg::SpatialDetectionArray>::SharedPtr detections_pub_;
  rclcpp::Publisher<visualization_msgs::msg::MarkerArray>::SharedPtr      markers_pub_;

  std::mutex intrinsics_mutex_;
  bool   intrinsics_ready_{false};
  double fx_{0}, fy_{0}, cx_{0}, cy_{0};
  int    img_w_{0}, img_h_{0};

  std::mutex              queue_mutex_;
  std::condition_variable queue_cv_;
  std::deque<FramePair>   frame_queue_;
  std::atomic<bool>       shutdown_{false};

  std::thread inference_thread_;

  Onnx::Env            onnx_env_;
  Onnx::SessionOptions session_opts_;
  std::unique_ptr<Onnx::InferenceSession> session_;
  std::string input_name_, output_name_;
  int model_input_w_{640}, model_input_h_{640};

  // === model loading =================================================

  void loadModel()
  {
    session_opts_.SetIntraOperatorThreadCount(2);
    session_opts_.SetGraphOptimizationLevel(
        GraphOptimizationLevel::ORT_ENABLE_ALL);

    try {
      session_ = std::make_unique<Onnx::InferenceSession>(
          onnx_env_, model_path_.c_str(), session_opts_);
    } catch (const std::exception& e) {
      RCLCPP_FATAL(get_logger(),
                   "Failed to load ONNX model '%s': %s",
                   model_path_.c_str(), e.what());
      throw;
    }

    input_name_  = session_->GetInputName(0);
    output_name_ = session_->GetOutputName(0);

    auto input_shape = session_->GetInputTypeAndShape(0)
                               ->GetTensorShapeData()->GetShape();
    // YOLOv8 ONNX layout: [batch, channels, H, W]
    if (input_shape.size() == 4) {
      model_input_h_ = static_cast<int>(input_shape[2]);
      model_input_w_ = static_cast<int>(input_shape[3]);
    }
  }

  // === callbacks =====================================================

  void onCameraInfo(const sensor_msgs::msg::CameraInfo& msg)
  {
    std::lock_guard<std::mutex> lk(intrinsics_mutex_);
    if (intrinsics_ready_) return;   // cache once

    fx_ = msg.k[0];  fy_ = msg.k[4];
    cx_ = msg.k[2];  cy_ = msg.k[5];
    img_w_ = static_cast<int>(msg.width);
    img_h_ = static_cast<int>(msg.height);
    intrinsics_ready_ = true;

    RCLCPP_INFO(get_logger(),
                "Intrinsics cached: fx=%.1f fy=%.1f cx=%.1f cy=%.1f (%dx%d)",
                fx_, fy_, cx_, cy_, img_w_, img_h_);
  }

  void onSync(const sensor_msgs::msg::Image& color_msg,
              const sensor_msgs::msg::Image& depth_msg)
  {
    if (!intrinsics_ready_) return;

    cv_bridge::CvImagePtr color_cv, depth_cv;
    try {
      color_cv = cv_bridge::toCvCopy(color_msg, "bgr8");
      depth_cv = cv_bridge::toCvCopy(depth_msg);   // mono16 stays CV_16UC1
    } catch (const cv_bridge::CvBridgeException& e) {
      RCLCPP_WARN(get_logger(), "cv_bridge: %s", e.what());
      return;
    }

    // Align depth to color resolution if needed
    cv::Mat depth = depth_cv->image;
    if (depth.cols != color_cv->image.cols ||
        depth.rows != color_cv->image.rows) {
      cv::resize(depth, depth,
                 cv::Size(color_cv->image.cols, color_cv->image.rows),
                 0, 0, cv::INTER_NEAREST);
    }

    {
      std::lock_guard<std::mutex> lk(queue_mutex_);
      if (static_cast<int>(frame_queue_.size()) >= max_queue_size_)
        frame_queue_.pop_front();   // drop oldest when full
      frame_queue_.push_back({
          color_cv->image.clone(),
          depth.clone(),
          color_msg.header.stamp,
          color_msg.header.frame_id});
    }
    queue_cv_.notify_one();
  }

  // === inference loop (dedicated thread) =================================

  void inferenceLoop()
  {
    while (!shutdown_.load()) {
      FramePair frame;
      {
        std::unique_lock<std::mutex> lk(queue_mutex_);
        queue_cv_.wait(lk, [this] {
          return !frame_queue_.empty() || shutdown_.load();
        });
        if (shutdown_.load()) break;
        frame = std::move(frame_queue_.front());
        frame_queue_.pop_front();
      }

      try {
        auto dets    = detect(frame.color);
        auto results = associateAndProject(dets, frame.depth);
        publishDetections(results, frame.stamp, frame.frame_id);
        if (publish_markers_)
          publishMarkers(results, frame.stamp, frame.frame_id);
      } catch (const std::exception& e) {
        RCLCPP_WARN(get_logger(), "Inference error: %s", e.what());
      }
    }
  }

  // === 2D detection (YOLOv8 + ONNX) =====================================

  std::vector<Detection2D> detect(const cv::Mat& image)
  {
    // Preprocess: resize → BGR→RGB → float32 CHW [0,1]
    cv::Mat resized;
    cv::resize(image, resized, cv::Size(model_input_w_, model_input_h_));
    cv::cvtColor(resized, resized, cv::COLOR_BGR2RGB);

    const int N = model_input_h_ * model_input_w_;
    std::vector<float> tensor(3 * N);
    for (int c = 0; c < 3; ++c)
      for (int h = 0; h < model_input_h_; ++h)
        for (int w = 0; w < model_input_w_; ++w)
          tensor[c * N + h * model_input_w_ + w] =
              resized.at<cv::Vec3u>(h, w)[c] / 255.0f;

    std::vector<int64_t> shape = {1, 3, model_input_h_, model_input_w_};
    auto mem = Onnx::MemoryInfo::CreateCpu(OrtArena, OrtDeviceAllocator);
    auto input_val = Onnx::Value::CreateTensor<float>(
        mem, tensor.data(), tensor.size(), shape.data(), shape.size());

    std::vector<const char*> in_names  = {input_name_.c_str()};
    std::vector<const char*> out_names = {output_name_.c_str()};

    auto outputs = session_->Run(
        nullptr, in_names.data(), &input_val, 1, out_names.data(), 1);

    return decodeYOLOv8(outputs);
  }

  // YOLOv8 output layout: [1, 4+num_classes, num_boxes]
  //   rows 0-3 : cx, cy, w, h  (pixels in model-input space)
  //   rows 4+  : per-class confidence scores
  std::vector<Detection2D> decodeYOLOv8(
      const std::vector<Onnx::Value>& outputs)
  {
    const float* data = outputs[0].GetTensorData<float>();
    auto shape        = outputs[0].GetTensorTypeAndShapeInfo()->GetShape();
    int64_t num_out   = shape[1];
    int64_t num_boxes = shape[2];
    int num_classes   = static_cast<int>(num_out) - 4;

    float sx = static_cast<float>(img_w_) / model_input_w_;
    float sy = static_cast<float>(img_h_) / model_input_h_;

    std::vector<Detection2D> raw;
    for (int64_t i = 0; i < num_boxes; ++i) {
      // find best class score
      float best_score = 0.0f;
      int   best_class = 0;
      for (int c = 0; c < num_classes; ++c) {
        float s = data[(4 + c) * num_boxes + i];
        if (s > best_score) { best_score = s; best_class = c; }
      }
      if (best_score < confidence_threshold_) continue;

      float cx = data[0 * num_boxes + i];
      float cy = data[1 * num_boxes + i];
      float bw = data[2 * num_boxes + i];
      float bh = data[3 * num_boxes + i];

      Detection2D d;
      d.x1 = std::clamp((cx - bw * 0.5f) * sx, 0.0f, static_cast<float>(img_w_  - 1));
      d.y1 = std::clamp((cy - bh * 0.5f) * sy, 0.0f, static_cast<float>(img_h_  - 1));
      d.x2 = std::clamp((cx + bw * 0.5f) * sx, 0.0f, static_cast<float>(img_w_  - 1));
      d.y2 = std::clamp((cy + bh * 0.5f) * sy, 0.0f, static_cast<float>(img_h_  - 1));
      d.confidence = best_score;
      d.class_id   = best_class;
      raw.push_back(d);
    }

    return nms(raw, 0.45f);
  }

  // --- NMS (per-class greedy) ----------------------------------------------

  static float iou(const Detection2D& a, const Detection2D& b)
  {
    float ix1 = std::max(a.x1, b.x1), iy1 = std::max(a.y1, b.y1);
    float ix2 = std::min(a.x2, b.x2), iy2 = std::min(a.y2, b.y2);
    float inter = std::max(0.0f, ix2 - ix1) * std::max(0.0f, iy2 - iy1);
    float aa = (a.x2 - a.x1) * (a.y2 - a.y1);
    float ab = (b.x2 - b.x1) * (b.y2 - b.y1);
    return inter / (aa + ab - inter + 1e-6f);
  }

  static std::vector<Detection2D> nms(std::vector<Detection2D>& dets,
                                       float iou_thresh)
  {
    std::sort(dets.begin(), dets.end(), [](const Detection2D& a,
                                           const Detection2D& b) {
      return a.confidence > b.confidence;
    });

    std::vector<bool> suppressed(dets.size(), false);
    std::vector<Detection2D> out;
    for (size_t i = 0; i < dets.size(); ++i) {
      if (suppressed[i]) continue;
      out.push_back(dets[i]);
      for (size_t j = i + 1; j < dets.size(); ++j) {
        if (suppressed[j] || dets[i].class_id != dets[j].class_id) continue;
        if (iou(dets[i], dets[j]) > iou_thresh) suppressed[j] = true;
      }
    }
    return out;
  }

  // === depth association & 3D projection ==================================

  // Sample depth within a bbox.  Returns depth in metres, or 0 on failure.
  float sampleDepth(const cv::Mat& depth,
                    int x1, int y1, int x2, int y2)
  {
    x1 = std::clamp(x1, 0, depth.cols - 1);
    y1 = std::clamp(y1, 0, depth.rows - 1);
    x2 = std::clamp(x2, 0, depth.cols - 1);
    y2 = std::clamp(y2, 0, depth.rows - 1);

    if (depth_method_ == "center") {
      uint16_t v = depth.at<uint16_t>((y1 + y2) / 2, (x1 + x2) / 2);
      float zm = static_cast<float>(v) / 1000.0f;
      return (zm >= min_depth_ && zm <= max_depth_) ? zm : 0.0f;
    }

    // Median over valid pixels in ROI
    int roi_w = x2 - x1, roi_h = y2 - y1;
    if (roi_w <= 0 || roi_h <= 0) return 0.0f;

    cv::Mat roi = depth.submat(y1, x1, roi_h, roi_w);
    std::vector<float> vals;
    vals.reserve(roi.rows * roi.cols);

    for (int r = 0; r < roi.rows; ++r)
      for (int c = 0; c < roi.cols; ++c) {
        float zm = static_cast<float>(roi.at<uint16_t>(r, c)) / 1000.0f;
        if (zm >= min_depth_ && zm <= max_depth_)
          vals.push_back(zm);
      }

    if (vals.empty()) return 0.0f;
    std::nth_element(vals.begin(), vals.begin() + vals.size() / 2, vals.end());
    return vals[vals.size() / 2];
  }

  std::vector<SpatialResult> associateAndProject(
      const std::vector<Detection2D>& dets, const cv::Mat& depth)
  {
    std::vector<SpatialResult> results;
    results.reserve(dets.size());

    for (const auto& det : dets) {
      SpatialResult r;
      r.bbox = det;

      float Z = sampleDepth(depth,
                            static_cast<int>(det.x1), static_cast<int>(det.y1),
                            static_cast<int>(det.x2), static_cast<int>(det.y2));

      if (Z <= 0.0f) {
        r.depth_valid = false;
        r.x = r.y = r.z = r.w = r.h = 0.0;
        results.push_back(r);
        continue;
      }

      r.depth_valid = true;
      r.z = Z;

      // Project bbox centre to 3D
      double u = (static_cast<double>(det.x1) + det.x2) / 2.0;
      double v = (static_cast<double>(det.y1) + det.y2) / 2.0;
      r.x = (u - cx_) * Z / fx_;
      r.y = (v - cy_) * Z / fy_;

      // Physical size from corner projection
      double x_l = (static_cast<double>(det.x1) - cx_) * Z / fx_;
      double x_r = (static_cast<double>(det.x2) - cx_) * Z / fx_;
      double y_t = (static_cast<double>(det.y1) - cy_) * Z / fy_;
      double y_b = (static_cast<double>(det.y2) - cy_) * Z / fy_;
      r.w = x_r - x_l;
      r.h = y_b - y_t;

      results.push_back(r);
    }
    return results;
  }

  // === publishing =========================================================

  void publishDetections(const std::vector<SpatialResult>& results,
                         const rclcpp::Time& stamp,
                         const std::string& frame_id)
  {
    depth_mapping::msg::SpatialDetectionArray msg;
    msg.header.stamp    = stamp;
    msg.header.frame_id = frame_id;

    for (const auto& r : results) {
      if (!r.depth_valid) continue;

      depth_mapping::msg::SpatialDetection d;
      d.class_name = (r.bbox.class_id < static_cast<int>(COCO_LABELS.size()))
                         ? COCO_LABELS[r.bbox.class_id]
                         : std::to_string(r.bbox.class_id);
      d.confidence = r.bbox.confidence;

      d.pose_camera.position.x    = r.x;
      d.pose_camera.position.y    = r.y;
      d.pose_camera.position.z    = r.z;
      d.pose_camera.orientation.x = 0.0;
      d.pose_camera.orientation.y = 0.0;
      d.pose_camera.orientation.z = 0.0;
      d.pose_camera.orientation.w = 1.0;   // identity — orientation unknown

      d.size.x = r.w;
      d.size.y = r.h;
      d.size.z = 0.0;

      msg.detections.push_back(d);
    }

    detections_pub_->publish(msg);
  }

  void publishMarkers(const std::vector<SpatialResult>& results,
                      const rclcpp::Time& stamp,
                      const std::string& frame_id)
  {
    visualization_msgs::msg::MarkerArray ma;
    int id = 0;

    for (const auto& r : results) {
      if (!r.depth_valid) continue;

      const std::string& label =
          (r.bbox.class_id < static_cast<int>(COCO_LABELS.size()))
              ? COCO_LABELS[r.bbox.class_id]
              : "unknown";

      // --- sphere at detection centre ----------------------------------------
      {
        visualization_msgs::msg::Marker m;
        m.header.stamp    = stamp;
        m.header.frame_id = frame_id;
        m.ns   = "sphere";
        m.id   = id++;
        m.type = visualization_msgs::msg::Marker::SPHERE;
        m.action = visualization_msgs::msg::Marker::ADD;
        m.pose.position.x = r.x;
        m.pose.position.y = r.y;
        m.pose.position.z = r.z;
        m.pose.orientation.w = 1.0;
        m.scale.x = m.scale.y = m.scale.z = 0.05;
        m.color.r = 0.0f; m.color.g = 1.0f;
        m.color.b = 0.0f; m.color.a = 1.0f;
        m.lifetime = rclcpp::Duration::from_seconds(1);
        ma.markers.push_back(m);
      }

      // --- text label --------------------------------------------------------
      {
        visualization_msgs::msg::Marker m;
        m.header.stamp    = stamp;
        m.header.frame_id = frame_id;
        m.ns   = "label";
        m.id   = id++;
        m.type = visualization_msgs::msg::Marker::TEXT_VIEW_FACING;
        m.action = visualization_msgs::msg::Marker::ADD;
        m.pose.position.x = r.x;
        m.pose.position.y = r.y - 0.08;
        m.pose.position.z = r.z;
        m.pose.orientation.w = 1.0;
        m.scale.z = 0.06;   // text height
        m.color.r = 1.0f; m.color.g = 1.0f;
        m.color.b = 1.0f; m.color.a = 1.0f;
        m.lifetime = rclcpp::Duration::from_seconds(1);

        std::ostringstream oss;
        oss << label << " " << static_cast<int>(r.bbox.confidence * 100) << "% "
            << std::fixed << std::setprecision(2) << r.z << "m";
        m.text = oss.str();
        ma.markers.push_back(m);
      }
    }

    markers_pub_->publish(ma);
  }
};

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

int main(int argc, char* argv[])
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<SpatialRecognitionNode>());
  rclcpp::shutdown();
  return 0;
}
