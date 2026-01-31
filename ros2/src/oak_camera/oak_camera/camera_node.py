#!/usr/bin/env python3
"""
OAK-D Camera Node with DepthAI Integration

This node connects to an OAK-D camera using the DepthAI library and publishes:
- RGB camera images
- Image classification results using MobileNet-SSD
- Detection bounding boxes

Topics published:
- /oak/rgb/image_raw (sensor_msgs/Image): RGB camera feed
- /oak/rgb/camera_info (sensor_msgs/CameraInfo): Camera information
- /oak/nn/detections (vision_msgs/Detection2DArray): Object detections
- /oak/nn/image (sensor_msgs/Image): Annotated image with detections
"""

import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Image, CameraInfo
from std_msgs.msg import String, Header
from vision_msgs.msg import Detection2D, Detection2DArray, ObjectHypothesisWithPose
from geometry_msgs.msg import Pose2D
import cv2
from cv_bridge import CvBridge
import depthai as dai
import numpy as np
from typing import Optional


class OAKCameraNode(Node):
    """ROS2 node for OAK-D camera with image classification"""

    def __init__(self):
        super().__init__('oak_camera_node')

        # Declare parameters
        self.declare_parameter('camera_fps', 30)
        self.declare_parameter('preview_width', 640)
        self.declare_parameter('preview_height', 480)
        self.declare_parameter('enable_classification', True)
        self.declare_parameter('confidence_threshold', 0.5)
        self.declare_parameter('model_name', 'mobilenet-ssd')

        # Get parameters
        self.camera_fps = self.get_parameter('camera_fps').value
        self.preview_width = self.get_parameter('preview_width').value
        self.preview_height = self.get_parameter('preview_height').value
        self.enable_classification = self.get_parameter('enable_classification').value
        self.confidence_threshold = self.get_parameter('confidence_threshold').value
        self.model_name = self.get_parameter('model_name').value

        # Publishers
        self.image_pub = self.create_publisher(Image, '/oak/rgb/image_raw', 10)
        self.camera_info_pub = self.create_publisher(CameraInfo, '/oak/rgb/camera_info', 10)
        self.detections_pub = self.create_publisher(Detection2DArray, '/oak/nn/detections', 10)
        self.annotated_image_pub = self.create_publisher(Image, '/oak/nn/image', 10)

        # CV Bridge for image conversion
        self.bridge = CvBridge()

        # MobileNet-SSD labels
        self.labels = [
            "background", "aeroplane", "bicycle", "bird", "boat", "bottle", "bus", "car", "cat",
            "chair", "cow", "diningtable", "dog", "horse", "motorbike", "person", "pottedplant",
            "sheep", "sofa", "train", "tvmonitor"
        ]

        # Initialize camera
        self.device: Optional[dai.Device] = None
        self.setup_camera()

        # Timer for publishing
        self.timer = self.create_timer(1.0 / self.camera_fps, self.timer_callback)

        self.get_logger().info('OAK Camera Node initialized')
        self.get_logger().info(f'  FPS: {self.camera_fps}')
        self.get_logger().info(f'  Resolution: {self.preview_width}x{self.preview_height}')
        self.get_logger().info(f'  Classification enabled: {self.enable_classification}')
        self.get_logger().info(f'  Model: {self.model_name}')

    def setup_camera(self):
        """Initialize the OAK camera and create the DepthAI pipeline"""
        try:
            # Create pipeline
            pipeline = dai.Pipeline()

            # Create RGB camera node
            cam_rgb = pipeline.create(dai.node.ColorCamera)
            cam_rgb.setPreviewSize(self.preview_width, self.preview_height)
            cam_rgb.setInterleaved(False)
            cam_rgb.setColorOrder(dai.ColorCameraProperties.ColorOrder.RGB)
            cam_rgb.setFps(self.camera_fps)

            # Create XLink output for preview
            xout_rgb = pipeline.create(dai.node.XLinkOut)
            xout_rgb.setStreamName("rgb")
            cam_rgb.preview.link(xout_rgb.input)

            if self.enable_classification:
                # Create neural network node for object detection
                detection_nn = pipeline.create(dai.node.MobileNetDetectionNetwork)
                detection_nn.setConfidenceThreshold(self.confidence_threshold)
                detection_nn.setBlobPath(self._get_model_path())

                # Link camera to neural network
                cam_rgb.preview.link(detection_nn.input)

                # Create XLink output for detections
                xout_nn = pipeline.create(dai.node.XLinkOut)
                xout_nn.setStreamName("detections")
                detection_nn.out.link(xout_nn.input)

                # Create passthrough for synced frames
                xout_passthrough = pipeline.create(dai.node.XLinkOut)
                xout_passthrough.setStreamName("passthrough")
                detection_nn.passthrough.link(xout_passthrough.input)

            # Connect to device and start pipeline
            self.device = dai.Device(pipeline)

            # Get output queues
            self.q_rgb = self.device.getOutputQueue(name="rgb", maxSize=4, blocking=False)

            if self.enable_classification:
                self.q_detections = self.device.getOutputQueue(name="detections", maxSize=4, blocking=False)
                self.q_passthrough = self.device.getOutputQueue(name="passthrough", maxSize=4, blocking=False)

            self.get_logger().info('Camera pipeline started successfully')

        except Exception as e:
            self.get_logger().error(f'Failed to initialize camera: {str(e)}')
            raise

    def _get_model_path(self) -> str:
        """Get the path to the neural network model blob"""
        # DepthAI provides built-in models, but you can also specify custom paths
        # For now, we'll use the default MobileNet-SSD model
        # In production, you'd download and specify the actual blob path
        import os
        model_dir = os.path.expanduser('~/.cache/depthai/models')
        model_path = os.path.join(model_dir, 'mobilenet-ssd_openvino_2021.4_6shave.blob')

        # If model doesn't exist, log warning and use default
        if not os.path.exists(model_path):
            self.get_logger().warn(
                f'Model not found at {model_path}. '
                'Download from: https://github.com/luxonis/depthai-python/tree/main/examples/models'
            )
            # Return a placeholder path - in production you'd handle this better
            return model_path

        return model_path

    def timer_callback(self):
        """Main callback to read camera frames and publish data"""
        try:
            # Get RGB frame
            in_rgb = self.q_rgb.tryGet()
            if in_rgb is None:
                return

            # Convert to OpenCV format
            frame = in_rgb.getCvFrame()

            # Publish raw image
            self.publish_image(frame)

            # Publish camera info
            self.publish_camera_info()

            # Process detections if enabled
            if self.enable_classification:
                in_det = self.q_detections.tryGet()
                in_pass = self.q_passthrough.tryGet()

                if in_det is not None and in_pass is not None:
                    detections = in_det.detections
                    frame_pass = in_pass.getCvFrame()

                    # Publish detections
                    self.publish_detections(detections, frame.shape)

                    # Publish annotated image
                    annotated_frame = self.annotate_frame(frame_pass, detections)
                    self.publish_annotated_image(annotated_frame)

        except Exception as e:
            self.get_logger().error(f'Error in timer callback: {str(e)}')

    def publish_image(self, frame: np.ndarray):
        """Publish raw RGB image"""
        try:
            msg = self.bridge.cv2_to_imgmsg(frame, encoding='rgb8')
            msg.header.stamp = self.get_clock().now().to_msg()
            msg.header.frame_id = 'oak_rgb_camera_optical_frame'
            self.image_pub.publish(msg)
        except Exception as e:
            self.get_logger().error(f'Failed to publish image: {str(e)}')

    def publish_camera_info(self):
        """Publish camera calibration info"""
        msg = CameraInfo()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = 'oak_rgb_camera_optical_frame'
        msg.width = self.preview_width
        msg.height = self.preview_height
        # Add calibration parameters if available
        self.camera_info_pub.publish(msg)

    def publish_detections(self, detections, frame_shape):
        """Publish object detections"""
        msg = Detection2DArray()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = 'oak_rgb_camera_optical_frame'

        height, width = frame_shape[:2]

        for detection in detections:
            det_msg = Detection2D()

            # Bounding box
            det_msg.bbox.center.position.x = detection.xmin * width + (detection.xmax - detection.xmin) * width / 2
            det_msg.bbox.center.position.y = detection.ymin * height + (detection.ymax - detection.ymin) * height / 2
            det_msg.bbox.size_x = (detection.xmax - detection.xmin) * width
            det_msg.bbox.size_y = (detection.ymax - detection.ymin) * height

            # Classification result
            result = ObjectHypothesisWithPose()
            result.hypothesis.class_id = str(detection.label)
            result.hypothesis.score = detection.confidence
            det_msg.results.append(result)

            msg.detections.append(det_msg)

        self.detections_pub.publish(msg)

        if len(detections) > 0:
            self.get_logger().info(
                f'Published {len(detections)} detections',
                throttle_duration_sec=2.0
            )

    def annotate_frame(self, frame: np.ndarray, detections) -> np.ndarray:
        """Draw bounding boxes and labels on frame"""
        annotated = frame.copy()
        height, width = frame.shape[:2]

        for detection in detections:
            # Get bounding box coordinates
            x1 = int(detection.xmin * width)
            y1 = int(detection.ymin * height)
            x2 = int(detection.xmax * width)
            y2 = int(detection.ymax * height)

            # Get label
            label_id = detection.label
            label = self.labels[label_id] if label_id < len(self.labels) else f"Class {label_id}"
            confidence = detection.confidence

            # Draw bounding box
            color = (0, 255, 0)  # Green
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

            # Draw label
            label_text = f"{label}: {confidence:.2f}"
            cv2.putText(
                annotated, label_text, (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2
            )

        return annotated

    def publish_annotated_image(self, frame: np.ndarray):
        """Publish annotated image with detections"""
        try:
            msg = self.bridge.cv2_to_imgmsg(frame, encoding='rgb8')
            msg.header.stamp = self.get_clock().now().to_msg()
            msg.header.frame_id = 'oak_rgb_camera_optical_frame'
            self.annotated_image_pub.publish(msg)
        except Exception as e:
            self.get_logger().error(f'Failed to publish annotated image: {str(e)}')

    def destroy_node(self):
        """Cleanup when node is destroyed"""
        if self.device is not None:
            self.device.close()
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
