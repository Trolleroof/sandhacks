#!/usr/bin/env python3
"""
Annotation node for OAK-D camera detections.

Subscribes to image and detection topics published by depthai_ros_driver,
draws bounding boxes with labels, and republishes the annotated image.

Topics subscribed:
- ~/image_in (sensor_msgs/Image): Raw camera feed (remapped from depthai_ros_driver)
- ~/detections_in (vision_msgs/Detection2DArray): Object detections

Topics published:
- ~/image_out (sensor_msgs/Image): Annotated image with bounding boxes
"""

import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Image
from vision_msgs.msg import Detection2DArray
import cv2
from cv_bridge import CvBridge
import numpy as np
import message_filters


class OAKAnnotationNode(Node):
    """Draws detection bounding boxes on camera images."""

    def __init__(self):
        super().__init__('oak_annotation_node')

        self.declare_parameter('confidence_threshold', 0.5)
        self.confidence_threshold = self.get_parameter('confidence_threshold').value

        # MobileNet-SSD labels
        self.labels = [
            "background", "aeroplane", "bicycle", "bird", "boat", "bottle",
            "bus", "car", "cat", "chair", "cow", "diningtable", "dog",
            "horse", "motorbike", "person", "pottedplant", "sheep", "sofa",
            "train", "tvmonitor",
        ]

        self.bridge = CvBridge()

        # Publisher
        self.image_pub = self.create_publisher(Image, '~/image_out', 10)

        # Subscribers with approximate time sync
        image_sub = message_filters.Subscriber(self, Image, '~/image_in')
        det_sub = message_filters.Subscriber(
            self, Detection2DArray, '~/detections_in')

        self.sync = message_filters.ApproximateTimeSynchronizer(
            [image_sub, det_sub], queue_size=10, slop=0.1)
        self.sync.registerCallback(self.callback)

        # Also subscribe to image alone so we publish even without detections
        self.image_only_sub = self.create_subscription(
            Image, '~/image_in', self.image_only_callback, 10)
        self._last_det_stamp = None

        self.get_logger().info('Annotation node ready — waiting for image + detection topics')

    def callback(self, img_msg: Image, det_msg: Detection2DArray):
        """Called when a synced image + detections pair arrives."""
        self._last_det_stamp = img_msg.header.stamp
        frame = self.bridge.imgmsg_to_cv2(img_msg, desired_encoding='bgr8')
        annotated = self._annotate(frame, det_msg)
        out_msg = self.bridge.cv2_to_imgmsg(annotated, encoding='bgr8')
        out_msg.header = img_msg.header
        self.image_pub.publish(out_msg)

    def image_only_callback(self, img_msg: Image):
        """Republish the raw image when no detections are available yet."""
        if self._last_det_stamp is not None:
            return  # synced callback is handling it
        self.image_pub.publish(img_msg)

    def _annotate(self, frame: np.ndarray, det_msg: Detection2DArray) -> np.ndarray:
        annotated = frame.copy()
        h, w = frame.shape[:2]

        for det in det_msg.detections:
            if not det.results:
                continue

            best = max(det.results, key=lambda r: r.hypothesis.score)
            if best.hypothesis.score < self.confidence_threshold:
                continue

            cx = det.bbox.center.position.x
            cy = det.bbox.center.position.y
            sx = det.bbox.size_x
            sy = det.bbox.size_y

            x1 = int(cx - sx / 2)
            y1 = int(cy - sy / 2)
            x2 = int(cx + sx / 2)
            y2 = int(cy + sy / 2)

            label_id = int(best.hypothesis.class_id) if best.hypothesis.class_id.isdigit() else -1
            label = self.labels[label_id] if 0 <= label_id < len(self.labels) else best.hypothesis.class_id
            conf = best.hypothesis.score

            color = (0, 255, 0)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            cv2.putText(
                annotated, f'{label}: {conf:.2f}', (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        return annotated


def main(args=None):
    rclpy.init(args=args)
    try:
        node = OAKAnnotationNode()
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    main()
