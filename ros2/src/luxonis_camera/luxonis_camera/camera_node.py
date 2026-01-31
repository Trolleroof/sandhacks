#!/usr/bin/env python3
"""ROS2 node for publishing Luxonis DepthAI camera frames."""

import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Image
from std_msgs.msg import Header
from cv_bridge import CvBridge
import numpy as np

try:
    import depthai as dai
    from luxonis_camera.camera_utils import wait_for_device, build_pipeline
    DEPTHAI_AVAILABLE = True
except ImportError:
    DEPTHAI_AVAILABLE = False


class LuxonisCameraNode(Node):
    """ROS2 node that publishes camera frames from Luxonis DepthAI camera."""

    def __init__(self):
        super().__init__('luxonis_camera_node')

        if not DEPTHAI_AVAILABLE:
            self.get_logger().error('depthai library not available. Install with: pip install depthai')
            return

        self.declare_parameter('publish_rate_hz', 30.0)
        self.declare_parameter('frame_id', 'camera_frame')

        self.publish_rate = self.get_parameter('publish_rate_hz').value
        self.frame_id = self.get_parameter('frame_id').value

        self.image_pub = self.create_publisher(Image, '/camera/image_raw', 10)

        self.bridge = CvBridge()

        self.device = None
        self.pipeline = None
        self.frame_queue = None

        self.get_logger().info('Luxonis Camera Node initialized')
        self.get_logger().info(f'  publish_rate_hz: {self.publish_rate}')
        self.get_logger().info(f'  frame_id: {self.frame_id}')

        self.timer = self.create_timer(1.0 / self.publish_rate, self.timer_callback)

    def start_camera(self):
        """Initialize and start the camera."""
        if not DEPTHAI_AVAILABLE:
            return False

        self.get_logger().info('Connecting to camera...')
        self.device = wait_for_device(max_attempts=5, pause=2.0)

        if not self.device:
            self.get_logger().error('Failed to connect to camera')
            return False

        self.pipeline, self.frame_queue = build_pipeline()

        try:
            self.get_logger().info('Starting pipeline...')
            self.device.startPipeline(self.pipeline)
            self.get_logger().info('Camera started successfully')
            return True
        except Exception as e:
            self.get_logger().error(f'Failed to start pipeline: {e}')
            return False

    def timer_callback(self):
        """Timer callback to publish camera frames."""
        if not DEPTHAI_AVAILABLE:
            return

        if self.device is None:
            if not self.start_camera():
                return

        if not self.device.isPipelineRunning():
            self.get_logger().warn('Pipeline not running, attempting to restart...')
            if not self.start_camera():
                return

        try:
            frame = self.frame_queue.get(timeout=1000)

            if frame is None:
                self.get_logger().warn('Timeout waiting for frame')
                return

            frame_np = frame.getCvFrame()

            header = Header()
            header.stamp = self.get_clock().now().to_msg()
            header.frame_id = self.frame_id

            image_msg = self.bridge.cv2_to_imgmsg(frame_np, encoding='bgr8')
            image_msg.header = header

            self.image_pub.publish(image_msg)

        except Exception as e:
            self.get_logger().error(f'Error getting frame: {e}')

    def destroy_node(self):
        """Clean up resources."""
        if self.device:
            self.device.close()
        super().destroy_node()


def main(args=None):
    """Main entry point."""
    rclpy.init(args=args)

    node = LuxonisCameraNode()

    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
