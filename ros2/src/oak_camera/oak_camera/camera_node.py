#!/usr/bin/env python3
"""
OAK-D Camera Node with YOLO Spatial Detection (DepthAI v2)

Uses YoloSpatialDetectionNetwork to detect objects and compute 3D spatial
coordinates (x, y, z) via stereo depth. Publishes filtered detections as
JSON with spatial data for frontend consumption.

Topics published:
- /oak/rgb/image_raw (sensor_msgs/Image): RGB camera feed
- /oak/rgb/camera_info (sensor_msgs/CameraInfo): Camera information
- /oak/nn/detections (vision_msgs/Detection2DArray): 2D detections (backward compat)
- /oak/nn/image (sensor_msgs/Image): Annotated image with detections + spatial info
- /oak/spatial/detections (std_msgs/String): JSON spatial detections with 3D coords
"""

import json
import math
import time
from typing import Optional, Set

import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Image, CameraInfo
from std_msgs.msg import String
from vision_msgs.msg import Detection2D, Detection2DArray, ObjectHypothesisWithPose
import cv2
from cv_bridge import CvBridge
import depthai as dai
import numpy as np
import blobconverter

# Full 80-class COCO label map (matches YOLO-v4-tiny-tf output)
COCO_LABELS = [
    "person", "bicycle", "car", "motorbike", "aeroplane", "bus", "train",
    "truck", "boat", "traffic light", "fire hydrant", "stop sign",
    "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep",
    "cow", "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella",
    "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard",
    "sports ball", "kite", "baseball bat", "baseball glove", "skateboard",
    "surfboard", "tennis racket", "bottle", "wine glass", "cup", "fork",
    "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
    "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair",
    "sofa", "pottedplant", "bed", "diningtable", "toilet", "tvmonitor",
    "laptop", "mouse", "remote", "keyboard", "cell phone", "microwave",
    "oven", "toaster", "sink", "refrigerator", "book", "clock", "vase",
    "scissors", "teddy bear", "hair drier", "toothbrush"
]


class OAKCameraNode(Node):
    """ROS2 node for OAK-D camera with YOLO spatial object detection"""

    def __init__(self):
        super().__init__('oak_camera_node')

        # Declare parameters
        self.declare_parameter('camera_fps', 30)
        self.declare_parameter('preview_width', 416)
        self.declare_parameter('preview_height', 416)
        self.declare_parameter('frame_id', 'oak_rgb_camera_optical_frame')
        self.declare_parameter('enable_spatial', True)
        self.declare_parameter('yolo_confidence_threshold', 0.5)
        self.declare_parameter('yolo_iou_threshold', 0.5)
        self.declare_parameter('yolo_model', 'yolo-v4-tiny-tf')
        self.declare_parameter('depth_lower_threshold', 100)
        self.declare_parameter('depth_upper_threshold', 10000)
        self.declare_parameter('bbox_scale_factor', 0.5)
        self.declare_parameter('target_classes', [24, 26, 28, 39, 41, 56, 63, 65, 66, 67, 73, 74])
        self.declare_parameter('device_discovery_attempts', 5)
        self.declare_parameter('device_discovery_pause', 2.0)

        # Get parameters
        self.camera_fps = self.get_parameter('camera_fps').value
        self.preview_width = self.get_parameter('preview_width').value
        self.preview_height = self.get_parameter('preview_height').value
        self.frame_id = self.get_parameter('frame_id').value
        self.enable_spatial = self.get_parameter('enable_spatial').value
        self.confidence_threshold = self.get_parameter('yolo_confidence_threshold').value
        self.iou_threshold = self.get_parameter('yolo_iou_threshold').value
        self.yolo_model = self.get_parameter('yolo_model').value
        self.depth_lower = self.get_parameter('depth_lower_threshold').value
        self.depth_upper = self.get_parameter('depth_upper_threshold').value
        self.bbox_scale = self.get_parameter('bbox_scale_factor').value
        self.device_discovery_attempts = self.get_parameter('device_discovery_attempts').value
        self.device_discovery_pause = self.get_parameter('device_discovery_pause').value

        # Target class filter
        target_list = self.get_parameter('target_classes').value
        self.target_classes: Set[int] = set(target_list) if target_list else set()

        # Publishers
        self.image_pub = self.create_publisher(Image, '/oak/rgb/image_raw', 10)
        self.camera_info_pub = self.create_publisher(CameraInfo, '/oak/rgb/camera_info', 10)
        self.detections_pub = self.create_publisher(Detection2DArray, '/oak/nn/detections', 10)
        self.annotated_image_pub = self.create_publisher(Image, '/oak/nn/image', 10)
        self.spatial_pub = self.create_publisher(String, '/oak/spatial/detections', 10)

        # CV Bridge
        self.bridge = CvBridge()

        # Camera state
        self.device: Optional[dai.Device] = None
        self.q_rgb = None
        self.q_detections = None
        self.pipeline_running = False

        # Try initial connection
        self.setup_camera()

        # Timer for publishing
        self.timer = self.create_timer(1.0 / self.camera_fps, self.timer_callback)

        self.get_logger().info('OAK Camera Node initialized (YOLO Spatial Detection)')
        self.get_logger().info(f'  FPS: {self.camera_fps}')
        self.get_logger().info(f'  Preview: {self.preview_width}x{self.preview_height}')
        self.get_logger().info(f'  Spatial detection: {self.enable_spatial}')
        self.get_logger().info(f'  YOLO model: {self.yolo_model}')
        self.get_logger().info(f'  Confidence: {self.confidence_threshold}')
        self.get_logger().info(f'  Depth range: {self.depth_lower}-{self.depth_upper}mm')
        if self.target_classes:
            names = [COCO_LABELS[i] for i in sorted(self.target_classes) if i < len(COCO_LABELS)]
            self.get_logger().info(f'  Target classes: {names}')
        else:
            self.get_logger().info('  Target classes: ALL (no filter)')

    def wait_for_device(self) -> Optional[dai.Device]:
        """Find and connect to the first available DepthAI device."""
        self.get_logger().info('Searching for devices...')

        for attempt in range(1, self.device_discovery_attempts + 1):
            try:
                candidates = []

                try:
                    bl_devices = dai.DeviceBootloader.getAllAvailableDevices()
                    self.get_logger().info(f'[scan {attempt}] bootloader sees {len(bl_devices)} device(s)')
                    candidates.extend(bl_devices)
                except Exception as e:
                    self.get_logger().debug(f'[scan {attempt}] bootloader scan: {e}')

                try:
                    app_devices = dai.Device.getAllAvailableDevices()
                    self.get_logger().info(f'[scan {attempt}] application sees {len(app_devices)} device(s)')
                    candidates.extend(app_devices)
                except Exception as e:
                    self.get_logger().debug(f'[scan {attempt}] application scan: {e}')

                for info in candidates:
                    try:
                        name = getattr(info, 'name', None) or '?'
                        state = str(info.state).split('X_LINK_')[-1] if hasattr(info, 'state') else 'UNKNOWN'
                        self.get_logger().info(f'  Attempting to connect to {name} (state={state})')

                        device = dai.Device(info)
                        mxid = device.getMxId()
                        platform = device.getPlatformAsString()
                        self.get_logger().info(f'Connected to {name} | mxid={mxid} platform={platform}')
                        return device
                    except Exception as e:
                        self.get_logger().debug(f'    Connection failed: {e}')
                        continue

            except Exception as e:
                self.get_logger().warn(f'Scan error (attempt {attempt}): {e}')

            if attempt < self.device_discovery_attempts:
                self.get_logger().info(f'Waiting {self.device_discovery_pause:.1f}s before retry...')
                time.sleep(self.device_discovery_pause)

        self.get_logger().error('No devices found after maximum attempts')
        return None

    def _get_yolo_blob_path(self) -> str:
        """Download YOLO blob from Luxonis model zoo via blobconverter."""
        self.get_logger().info(f'Fetching YOLO model: {self.yolo_model}')
        try:
            blob_path = blobconverter.from_zoo(
                name=self.yolo_model,
                shaves=6,
                zoo_type="depthai",
            )
            self.get_logger().info(f'YOLO blob path: {blob_path}')
            return blob_path
        except Exception as e:
            self.get_logger().error(f'Failed to download YOLO model: {e}')
            return ""

    def setup_camera(self):
        """Initialize the OAK camera with YOLO spatial detection pipeline."""
        try:
            self.device = self.wait_for_device()
            if not self.device:
                self.get_logger().error('Cannot continue without camera device')
                return

            pipeline = dai.Pipeline()

            # --- RGB Camera ---
            cam_rgb = pipeline.create(dai.node.ColorCamera)
            cam_rgb.setPreviewSize(self.preview_width, self.preview_height)
            cam_rgb.setResolution(dai.ColorCameraProperties.SensorResolution.THE_1080_P)
            cam_rgb.setInterleaved(False)
            cam_rgb.setColorOrder(dai.ColorCameraProperties.ColorOrder.BGR)
            cam_rgb.setFps(self.camera_fps)

            # XLink output for RGB preview
            xout_rgb = pipeline.create(dai.node.XLinkOut)
            xout_rgb.setStreamName("rgb")
            cam_rgb.preview.link(xout_rgb.input)

            if self.enable_spatial:
                # --- Mono Cameras for Stereo Depth ---
                mono_left = pipeline.create(dai.node.MonoCamera)
                mono_left.setResolution(dai.MonoCameraProperties.SensorResolution.THE_400_P)
                mono_left.setBoardSocket(dai.CameraBoardSocket.LEFT)

                mono_right = pipeline.create(dai.node.MonoCamera)
                mono_right.setResolution(dai.MonoCameraProperties.SensorResolution.THE_400_P)
                mono_right.setBoardSocket(dai.CameraBoardSocket.RIGHT)

                # --- Stereo Depth ---
                stereo = pipeline.create(dai.node.StereoDepth)
                stereo.setDefaultProfilePreset(dai.node.StereoDepth.PresetMode.HIGH_DENSITY)
                stereo.setDepthAlign(dai.CameraBoardSocket.RGB)
                mono_left.out.link(stereo.left)
                mono_right.out.link(stereo.right)

                # --- YOLO Spatial Detection Network ---
                blob_path = self._get_yolo_blob_path()
                if not blob_path:
                    self.get_logger().error('No YOLO blob available, spatial detection disabled')
                    self.enable_spatial = False
                else:
                    yolo = pipeline.create(dai.node.YoloSpatialDetectionNetwork)
                    yolo.setBlobPath(blob_path)
                    yolo.setConfidenceThreshold(self.confidence_threshold)
                    yolo.setNumClasses(80)
                    yolo.setCoordinateSize(4)
                    yolo.setAnchors([10, 14, 23, 27, 37, 58, 81, 82, 135, 169, 344, 319])
                    yolo.setAnchorMasks({"side26": [0, 1, 2], "side13": [3, 4, 5]})
                    yolo.setIouThreshold(self.iou_threshold)
                    yolo.input.setBlocking(False)

                    # Spatial config
                    yolo.setBoundingBoxScaleFactor(self.bbox_scale)
                    yolo.setDepthLowerThreshold(self.depth_lower)
                    yolo.setDepthUpperThreshold(self.depth_upper)

                    # Link RGB to YOLO
                    cam_rgb.preview.link(yolo.input)

                    # Link stereo depth to YOLO
                    stereo.depth.link(yolo.inputDepth)

                    # XLink output for spatial detections
                    xout_det = pipeline.create(dai.node.XLinkOut)
                    xout_det.setStreamName("detections")
                    yolo.out.link(xout_det.input)

            # Start pipeline
            self.device.startPipeline(pipeline)

            # Get output queues
            self.q_rgb = self.device.getOutputQueue(name="rgb", maxSize=4, blocking=False)

            if self.enable_spatial:
                self.q_detections = self.device.getOutputQueue(name="detections", maxSize=4, blocking=False)

            self.pipeline_running = True
            self.get_logger().info('Camera pipeline started successfully')

        except Exception as e:
            self.get_logger().error(f'Failed to initialize camera: {str(e)}')
            self.pipeline_running = False

    def timer_callback(self):
        """Main callback to read camera frames and publish data."""
        try:
            if not self.pipeline_running or self.device is None:
                if not self.device or not self.device.isPipelineRunning():
                    self.get_logger().warn('Pipeline not running, attempting to restart...')
                    self.setup_camera()
                return

            # Get RGB frame
            in_rgb = self.q_rgb.tryGet()
            if in_rgb is None:
                return

            frame = in_rgb.getCvFrame()

            # Publish raw image
            self.publish_image(frame)
            self.publish_camera_info()

            # Process spatial detections
            if self.enable_spatial and self.q_detections is not None:
                in_det = self.q_detections.tryGet()
                if in_det is not None:
                    detections = in_det.detections

                    # Filter to target classes
                    if self.target_classes:
                        filtered = [d for d in detections if int(d.label) in self.target_classes]
                    else:
                        filtered = list(detections)

                    # Publish all formats
                    self.publish_detections_2d(filtered, frame.shape)
                    self.publish_spatial_detections(filtered)

                    # Annotated image
                    annotated = self.annotate_frame(frame, filtered)
                    self.publish_annotated_image(annotated)

        except Exception as e:
            self.get_logger().error(f'Error in timer callback: {str(e)}')
            self.pipeline_running = False

    def publish_image(self, frame: np.ndarray):
        """Publish raw RGB image."""
        try:
            msg = self.bridge.cv2_to_imgmsg(frame, encoding='bgr8')
            msg.header.stamp = self.get_clock().now().to_msg()
            msg.header.frame_id = self.frame_id
            self.image_pub.publish(msg)
        except Exception as e:
            self.get_logger().error(f'Failed to publish image: {str(e)}')

    def publish_camera_info(self):
        """Publish camera calibration info."""
        msg = CameraInfo()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = self.frame_id
        msg.width = self.preview_width
        msg.height = self.preview_height
        self.camera_info_pub.publish(msg)

    def publish_detections_2d(self, detections, frame_shape):
        """Publish 2D detections for backward compatibility."""
        msg = Detection2DArray()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = self.frame_id

        height, width = frame_shape[:2]

        for detection in detections:
            det_msg = Detection2D()

            x_min = detection.xmin * width
            y_min = detection.ymin * height
            x_max = detection.xmax * width
            y_max = detection.ymax * height

            det_msg.bbox.center.position.x = (x_min + x_max) / 2
            det_msg.bbox.center.position.y = (y_min + y_max) / 2
            det_msg.bbox.size_x = x_max - x_min
            det_msg.bbox.size_y = y_max - y_min

            result = ObjectHypothesisWithPose()
            label_id = int(detection.label)
            result.hypothesis.class_id = COCO_LABELS[label_id] if label_id < len(COCO_LABELS) else str(label_id)
            result.hypothesis.score = float(detection.confidence)
            det_msg.results.append(result)

            msg.detections.append(det_msg)

        self.detections_pub.publish(msg)

    def publish_spatial_detections(self, detections):
        """Publish spatial detections as JSON with 3D coordinates."""
        now = self.get_clock().now()
        stamp = now.nanoseconds / 1e9

        det_list = []
        for detection in detections:
            label_id = int(detection.label)
            label = COCO_LABELS[label_id] if label_id < len(COCO_LABELS) else f"class_{label_id}"

            sx = float(detection.spatialCoordinates.x)  # mm
            sy = float(detection.spatialCoordinates.y)  # mm
            sz = float(detection.spatialCoordinates.z)  # mm

            distance_mm = math.sqrt(sx * sx + sy * sy + sz * sz)

            det_list.append({
                "label": label,
                "label_id": label_id,
                "confidence": round(float(detection.confidence), 3),
                "bbox": {
                    "x_min": round(float(detection.xmin), 4),
                    "y_min": round(float(detection.ymin), 4),
                    "x_max": round(float(detection.xmax), 4),
                    "y_max": round(float(detection.ymax), 4),
                },
                "spatial_mm": {
                    "x": round(sx, 1),
                    "y": round(sy, 1),
                    "z": round(sz, 1),
                },
                "spatial_meters": {
                    "x": round(sx / 1000.0, 3),
                    "y": round(sy / 1000.0, 3),
                    "z": round(sz / 1000.0, 3),
                },
                "distance_meters": round(distance_mm / 1000.0, 3),
            })

        payload = {
            "timestamp": round(stamp, 3),
            "frame_id": self.frame_id,
            "detections": det_list,
        }

        msg = String()
        msg.data = json.dumps(payload)
        self.spatial_pub.publish(msg)

    def annotate_frame(self, frame: np.ndarray, detections) -> np.ndarray:
        """Draw bounding boxes, labels, and spatial coordinates on frame."""
        annotated = frame.copy()
        height, width = frame.shape[:2]

        for detection in detections:
            x1 = int(detection.xmin * width)
            y1 = int(detection.ymin * height)
            x2 = int(detection.xmax * width)
            y2 = int(detection.ymax * height)

            label_id = int(detection.label)
            label = COCO_LABELS[label_id] if label_id < len(COCO_LABELS) else f"class_{label_id}"
            confidence = detection.confidence

            sx = detection.spatialCoordinates.x
            sy = detection.spatialCoordinates.y
            sz = detection.spatialCoordinates.z
            dist_m = math.sqrt(sx * sx + sy * sy + sz * sz) / 1000.0

            color = (0, 255, 0)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

            # Label + confidence
            label_text = f"{label} {confidence:.0%}"
            cv2.putText(annotated, label_text, (x1, y1 - 25),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

            # Spatial info
            spatial_text = f"X:{sx:.0f} Y:{sy:.0f} Z:{sz:.0f}mm"
            cv2.putText(annotated, spatial_text, (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)

            # Distance below box
            dist_text = f"{dist_m:.2f}m"
            cv2.putText(annotated, dist_text, (x1, y2 + 15),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 200, 255), 2)

        return annotated

    def publish_annotated_image(self, frame: np.ndarray):
        """Publish annotated image with detections."""
        try:
            msg = self.bridge.cv2_to_imgmsg(frame, encoding='bgr8')
            msg.header.stamp = self.get_clock().now().to_msg()
            msg.header.frame_id = self.frame_id
            self.annotated_image_pub.publish(msg)
        except Exception as e:
            self.get_logger().error(f'Failed to publish annotated image: {str(e)}')

    def destroy_node(self):
        """Cleanup when node is destroyed."""
        self.pipeline_running = False
        if self.device is not None:
            try:
                self.device.close()
            except Exception as e:
                self.get_logger().error(f'Error closing device: {e}')
        super().destroy_node()


def main(args=None):
    rclpy.init(args=args)

    try:
        node = OAKCameraNode()
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(f'Error: {e}')
    finally:
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    main()
