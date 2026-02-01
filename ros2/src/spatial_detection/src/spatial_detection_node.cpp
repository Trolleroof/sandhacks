// ---------------------------------------------------------------------------
// spatial_detection_node
//
// Runs a YOLO spatial detection pipeline on a Luxonis OAK camera via DepthAI.
// Publishes annotated RGB, colorized depth, and per-frame detection data.
//
// Publications
//   /spatial_detection/rgb            (sensor_msgs/Image)   — raw BGR frame
//   /spatial_detection/rgb_annotated  (sensor_msgs/Image)   — bboxes + labels + XYZ
//   /spatial_detection/depth          (sensor_msgs/Image)   — colorized depth
//   /spatial_detection/detections     (std_msgs/String)     — JSON detection array
// ---------------------------------------------------------------------------

#include <iomanip>
#include <sstream>
#include <string>
#include <vector>

#include <cv_bridge/cv_bridge.h>
#include <depthai/depthai.hpp>
#include <rclcpp/rclcpp.hpp>
#include <sensor_msgs/msg/image.hpp>
#include <std_msgs/msg/string.hpp>

static const std::vector<std::string> LABEL_MAP = {
    "person",        "bicycle",      "car",           "motorbike",     "aeroplane",   "bus",
    "train",         "truck",        "boat",          "traffic light", "fire hydrant",
    "stop sign",     "parking meter","bench",         "bird",          "cat",
    "dog",           "horse",        "sheep",         "cow",           "elephant",
    "bear",          "zebra",        "giraffe",       "backpack",      "umbrella",
    "handbag",       "tie",          "suitcase",      "frisbee",       "skis",
    "snowboard",     "sports ball",  "kite",          "baseball bat",  "baseball glove",
    "skateboard",    "surfboard",    "tennis racket", "bottle",        "wine glass",
    "cup",           "fork",         "knife",         "spoon",         "bowl",
    "banana",        "apple",        "sandwich",      "orange",        "broccoli",
    "carrot",        "hot dog",      "pizza",         "donut",         "cake",
    "chair",         "sofa",         "pottedplant",   "bed",           "diningtable",
    "toilet",        "tvmonitor",    "laptop",        "mouse",         "remote",
    "keyboard",      "cell phone",   "microwave",     "oven",          "toaster",
    "sink",          "refrigerator", "book",          "clock",         "vase",
    "scissors",      "teddy bear",   "hair drier",    "toothbrush"
};

class SpatialDetectionNode : public rclcpp::Node
{
public:
  explicit SpatialDetectionNode() : rclcpp::Node("spatial_detection_node")
  {
    declare_parameter("blob_path",              std::string(""));
    declare_parameter("confidence_threshold",   0.5);
    declare_parameter("iou_threshold",          0.5);
    declare_parameter("sync_nn",                true);
    declare_parameter("depth_lower_threshold",  100);
    declare_parameter("depth_upper_threshold",  5000);

    blob_path_              = get_parameter("blob_path").as_string();
    confidence_threshold_   = static_cast<float>(get_parameter("confidence_threshold").as_double());
    iou_threshold_          = static_cast<float>(get_parameter("iou_threshold").as_double());
    sync_nn_                = get_parameter("sync_nn").as_bool();
    depth_lower_threshold_  = get_parameter("depth_lower_threshold").as_int();
    depth_upper_threshold_  = get_parameter("depth_upper_threshold").as_int();

    rgb_pub_            = create_publisher<sensor_msgs::msg::Image>("/spatial_detection/rgb",            rclcpp::QoS(4));
    rgb_annotated_pub_  = create_publisher<sensor_msgs::msg::Image>("/spatial_detection/rgb_annotated",  rclcpp::QoS(4));
    depth_pub_          = create_publisher<sensor_msgs::msg::Image>("/spatial_detection/depth",          rclcpp::QoS(4));
    detections_pub_     = create_publisher<std_msgs::msg::String>("/spatial_detection/detections",       rclcpp::QoS(4));

    RCLCPP_INFO(get_logger(), "spatial_detection_node starting");
    RCLCPP_INFO(get_logger(), "  blob_path            : %s", blob_path_.c_str());
    RCLCPP_INFO(get_logger(), "  confidence_threshold : %.2f", confidence_threshold_);
    RCLCPP_INFO(get_logger(), "  sync_nn              : %s", sync_nn_ ? "true" : "false");
  }

  // Blocking loop — call from main after construction.
  void run()
  {
    setupPipeline();
    dai::Device device(pipeline_);

    auto previewQueue  = device.getOutputQueue("rgb",        4, false);
    auto detectionQueue= device.getOutputQueue("detections", 4, false);
    auto depthQueue    = device.getOutputQueue("depth",      4, false);

    auto startTime  = std::chrono::steady_clock::now();
    int  counter    = 0;
    float fps       = 0.0f;
    const auto color = cv::Scalar(255, 255, 255);

    while (rclcpp::ok()) {
      auto imgFrame  = previewQueue ->get<dai::ImgFrame>();
      auto inDet     = detectionQueue->get<dai::SpatialImgDetections>();
      auto depth     = depthQueue   ->get<dai::ImgFrame>();

      cv::Mat frame      = imgFrame->getCvFrame();
      cv::Mat annotated  = frame.clone();       // separate copy for drawn annotations
      cv::Mat depthFrame = depth->getFrame();   // values in mm

      // Colorize depth map
      cv::Mat depthColor;
      cv::normalize(depthFrame, depthColor, 255, 0, cv::NORM_INF, CV_8UC1);
      cv::equalizeHist(depthColor, depthColor);
      cv::applyColorMap(depthColor, depthColor, cv::COLORMAP_HOT);

      // FPS tracking
      ++counter;
      auto now     = std::chrono::steady_clock::now();
      auto elapsed = std::chrono::duration_cast<std::chrono::duration<float>>(now - startTime);
      if (elapsed > std::chrono::seconds(1)) {
        fps     = counter / elapsed.count();
        counter = 0;
        startTime = now;
      }

      // Process detections — annotate frames and build JSON payload
      std::ostringstream detJson;
      detJson << "[";
      const auto& detections = inDet->detections;

      for (size_t i = 0; i < detections.size(); ++i) {
        const auto& det = detections[i];
        if (i > 0) detJson << ",";

        // --- depth-frame bounding box -----------------------------------------
        auto roi = det.boundingBoxMapping.roi;
        roi = roi.denormalize(depthColor.cols, depthColor.rows);
        cv::rectangle(depthColor,
                      cv::Point(static_cast<int>(roi.topLeft().x),
                                static_cast<int>(roi.topLeft().y)),
                      cv::Point(static_cast<int>(roi.bottomRight().x),
                                static_cast<int>(roi.bottomRight().y)),
                      color, cv::FONT_HERSHEY_SIMPLEX);

        // --- RGB bounding box & labels ----------------------------------------
        int x1 = static_cast<int>(det.xmin * frame.cols);
        int y1 = static_cast<int>(det.ymin * frame.rows);
        int x2 = static_cast<int>(det.xmax * frame.cols);
        int y2 = static_cast<int>(det.ymax * frame.rows);

        std::string label = std::to_string(det.label);
        if (static_cast<size_t>(det.label) < LABEL_MAP.size())
          label = LABEL_MAP[det.label];

        cv::rectangle(annotated, cv::Point(x1, y1), cv::Point(x2, y2), color, cv::FONT_HERSHEY_SIMPLEX);
        cv::putText(annotated, label,                                  cv::Point(x1+10, y1+20), cv::FONT_HERSHEY_TRIPLEX, 0.5, 255);

        std::ostringstream confStr;
        confStr << std::fixed << std::setprecision(2) << det.confidence * 100;
        cv::putText(annotated, confStr.str() + "%",                    cv::Point(x1+10, y1+35), cv::FONT_HERSHEY_TRIPLEX, 0.5, 255);

        int sx = static_cast<int>(det.spatialCoordinates.x);
        int sy = static_cast<int>(det.spatialCoordinates.y);
        int sz = static_cast<int>(det.spatialCoordinates.z);

        cv::putText(annotated, "X: " + std::to_string(sx) + " mm",    cv::Point(x1+10, y1+50), cv::FONT_HERSHEY_TRIPLEX, 0.5, 255);
        cv::putText(annotated, "Y: " + std::to_string(sy) + " mm",    cv::Point(x1+10, y1+65), cv::FONT_HERSHEY_TRIPLEX, 0.5, 255);
        cv::putText(annotated, "Z: " + std::to_string(sz) + " mm",    cv::Point(x1+10, y1+80), cv::FONT_HERSHEY_TRIPLEX, 0.5, 255);

        // --- JSON entry -------------------------------------------------------
        detJson << "{"
                << "\"label\":\""    << label << "\""
                << ",\"confidence\":" << std::fixed << std::setprecision(3) << det.confidence
                << ",\"bbox\":{\"x1\":"  << x1 << ",\"y1\":" << y1
                                     << ",\"x2\":" << x2 << ",\"y2\":" << y2 << "}"
                << ",\"spatial\":{\"x\":" << sx << ",\"y\":" << sy << ",\"z\":" << sz << "}"
                << "}";
      }
      detJson << "]";

      // FPS overlay (annotated only)
      std::ostringstream fpsStr;
      fpsStr << std::fixed << std::setprecision(2) << fps;
      cv::putText(annotated, fpsStr.str(), cv::Point(2, imgFrame->getHeight() - 4),
                  cv::FONT_HERSHEY_TRIPLEX, 0.4, color);

      // --- Publish --------------------------------------------------------------
      std_msgs::msg::Header header;
      header.stamp    = get_clock()->now();
      header.frame_id = "camera_link";

      rgb_pub_           ->publish(*cv_bridge::CvImage(header, "bgr8", frame).toImageMsg());
      rgb_annotated_pub_ ->publish(*cv_bridge::CvImage(header, "bgr8", annotated).toImageMsg());
      depth_pub_         ->publish(*cv_bridge::CvImage(header, "bgr8", depthColor).toImageMsg());

      std_msgs::msg::String detMsg;
      detMsg.data = detJson.str();
      detections_pub_->publish(detMsg);
    }
  }

private:
  // Parameters
  std::string blob_path_;
  float       confidence_threshold_;
  float       iou_threshold_;
  bool        sync_nn_;
  int         depth_lower_threshold_;
  int         depth_upper_threshold_;

  // DepthAI pipeline (constructed once, handed to device)
  dai::Pipeline pipeline_;

  // Publishers
  rclcpp::Publisher<sensor_msgs::msg::Image>::SharedPtr  rgb_pub_;
  rclcpp::Publisher<sensor_msgs::msg::Image>::SharedPtr  rgb_annotated_pub_;
  rclcpp::Publisher<sensor_msgs::msg::Image>::SharedPtr  depth_pub_;
  rclcpp::Publisher<std_msgs::msg::String>::SharedPtr    detections_pub_;

  void setupPipeline()
  {
    auto camRgb    = pipeline_.create<dai::node::ColorCamera>();
    auto monoLeft  = pipeline_.create<dai::node::MonoCamera>();
    auto monoRight = pipeline_.create<dai::node::MonoCamera>();
    auto stereo    = pipeline_.create<dai::node::StereoDepth>();
    auto yoloSpatial = pipeline_.create<dai::node::YoloSpatialDetectionNetwork>();

    auto xoutRgb   = pipeline_.create<dai::node::XLinkOut>();
    auto xoutNN    = pipeline_.create<dai::node::XLinkOut>();
    auto xoutDepth = pipeline_.create<dai::node::XLinkOut>();

    xoutRgb  ->setStreamName("rgb");
    xoutNN   ->setStreamName("detections");
    xoutDepth->setStreamName("depth");

    // --- Camera config --------------------------------------------------------
    camRgb->setPreviewSize(416, 416);
    camRgb->setResolution(dai::ColorCameraProperties::SensorResolution::THE_1080_P);
    camRgb->setInterleaved(false);
    camRgb->setColorOrder(dai::ColorCameraProperties::ColorOrder::BGR);

    monoLeft ->setResolution(dai::MonoCameraProperties::SensorResolution::THE_400_P);
    monoLeft ->setCamera("left");
    monoRight->setResolution(dai::MonoCameraProperties::SensorResolution::THE_400_P);
    monoRight->setCamera("right");

    // --- Stereo depth ---------------------------------------------------------
    stereo->setDefaultProfilePreset(dai::node::StereoDepth::PresetMode::DEFAULT);
    stereo->setDepthAlign(dai::CameraBoardSocket::CAM_A);
    stereo->setOutputSize(monoLeft->getResolutionWidth(), monoLeft->getResolutionHeight());

    // --- YOLO spatial detection network ---------------------------------------
    yoloSpatial->setBlobPath(blob_path_);
    yoloSpatial->setConfidenceThreshold(confidence_threshold_);
    yoloSpatial->input.setBlocking(false);
    yoloSpatial->setBoundingBoxScaleFactor(0.5);
    yoloSpatial->setDepthLowerThreshold(depth_lower_threshold_);
    yoloSpatial->setDepthUpperThreshold(depth_upper_threshold_);

    yoloSpatial->setNumClasses(80);
    yoloSpatial->setCoordinateSize(4);
    yoloSpatial->setAnchors({10, 14, 23, 27, 37, 58, 81, 82, 135, 169, 344, 319});
    yoloSpatial->setAnchorMasks({{"side26", {1, 2, 3}}, {"side13", {3, 4, 5}}});
    yoloSpatial->setIouThreshold(iou_threshold_);

    // --- Linking --------------------------------------------------------------
    monoLeft ->out.link(stereo->left);
    monoRight->out.link(stereo->right);

    camRgb->preview.link(yoloSpatial->input);

    if (sync_nn_)
      yoloSpatial->passthrough.link(xoutRgb->input);
    else
      camRgb->preview.link(xoutRgb->input);

    yoloSpatial->out.link(xoutNN->input);

    stereo->depth.link(yoloSpatial->inputDepth);
    yoloSpatial->passthroughDepth.link(xoutDepth->input);
  }
};

int main(int argc, char* argv[])
{
  rclcpp::init(argc, argv);
  auto node = std::make_shared<SpatialDetectionNode>();
  node->run();
  rclcpp::shutdown();
  return 0;
}
