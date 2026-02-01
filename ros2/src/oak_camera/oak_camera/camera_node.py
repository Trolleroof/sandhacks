#!/usr/bin/env python3
"""
Annotates depthai_ros_driver detections on RGB frames.

Subscribes:
- /oak/rgb/image_raw (sensor_msgs/Image)
- /oak/nn/detections (vision_msgs/Detection2DArray)

Publishes:
- /oak/nn/image (sensor_msgs/Image): annotated image
- /oak/spatial/detections (std_msgs/String): JSON spatial detections
"""

import json
import math
from pathlib import Path
from typing import Optional, Sequence, Set, Tuple

import cv2
from cv_bridge import CvBridge
import numpy as np
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import CameraInfo, Image
from std_msgs.msg import String
from vision_msgs.msg import Detection2D, Detection2DArray, Detection3DArray, ObjectHypothesisWithPose

# Optional COCO label map (used when class_id is numeric)
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
    "scissors", "teddy bear", "hair drier", "toothbrush",
]


class OAKCameraNode(Node):
    """Subscribe to depthai_ros_driver outputs and publish annotated frames."""

    def __init__(self) -> None:
        super().__init__('oak_camera_node')

        self.declare_parameter('enable_class_filter', False)
        self.declare_parameter('target_classes', [])
        self.declare_parameter('use_local_inference', False)
        self.declare_parameter('local_model_path', '')
        self.declare_parameter('local_config_path', '')
        self.declare_parameter('local_labels_path', '')
        self.declare_parameter('local_input_width', 300)
        self.declare_parameter('local_input_height', 300)
        self.declare_parameter('local_conf_threshold', 0.5)
        self.declare_parameter('local_scale', 0.007843)
        self.declare_parameter('local_mean', [127.5, 127.5, 127.5])
        self.declare_parameter('local_swap_rb', False)
        self.enable_class_filter = bool(self.get_parameter('enable_class_filter').value)
        target_list = self.get_parameter('target_classes').value
        self.target_classes: Set[str] = self._normalize_targets(target_list)
        self.use_local_inference = bool(self.get_parameter('use_local_inference').value)
        self.local_model_path = str(self.get_parameter('local_model_path').value)
        self.local_config_path = str(self.get_parameter('local_config_path').value)
        self.local_labels_path = str(self.get_parameter('local_labels_path').value)
        self.local_input_width = int(self.get_parameter('local_input_width').value)
        self.local_input_height = int(self.get_parameter('local_input_height').value)
        self.local_conf_threshold = float(self.get_parameter('local_conf_threshold').value)
        self.local_scale = float(self.get_parameter('local_scale').value)
        self.local_mean = self.get_parameter('local_mean').value
        self.local_swap_rb = bool(self.get_parameter('local_swap_rb').value)

        self.bridge = CvBridge()
        self.latest_detections: Optional[Detection2DArray] = None
        self.latest_image_shape: Optional[Tuple[int, int]] = None  # (height, width)
        self.camera_width: Optional[int] = None
        self.camera_height: Optional[int] = None
        self.fx: Optional[float] = None
        self.fy: Optional[float] = None
        self.cx: Optional[float] = None
        self.cy: Optional[float] = None
        self.net = None
        self.labels = []

        if self.use_local_inference:
            self._load_local_model()

        self.image_sub = self.create_subscription(
            Image,
            '/oak/rgb/image_raw',
            self.on_image,
            10,
        )
        self.camera_info_sub = self.create_subscription(
            CameraInfo,
            '/oak/rgb/camera_info',
            self.on_camera_info,
            10,
        )
        self.detections_sub = self.create_subscription(
            Detection2DArray,
            '/oak/nn/detections',
            self.on_detections,
            10,
        )
        self.spatial_detections_sub = self.create_subscription(
            Detection3DArray,
            '/oak/nn/spatial_detections',
            self.on_spatial_detections,
            10,
        )

        self.detections_pub = self.create_publisher(Detection2DArray, '/oak/nn/detections', 10)
        self.annotated_pub = self.create_publisher(Image, '/oak/nn/image', 10)
        self.spatial_pub = self.create_publisher(String, '/oak/spatial/detections', 10)

        self.get_logger().info('OAK annotation node initialized')
        if self.enable_class_filter and self.target_classes:
            self.get_logger().info(f'Class filter enabled: {sorted(self.target_classes)}')
        else:
            self.get_logger().info('Class filter disabled: ALL detections will pass')
        if self.use_local_inference:
            if self.net is None:
                self.get_logger().warn('Local inference enabled but model failed to load')
            else:
                self.get_logger().info('Local inference enabled (CPU via OpenCV DNN)')

    def _normalize_targets(self, target_list: Sequence) -> Set[str]:
        if not target_list:
            return set()
        return {str(value).lower() for value in target_list}

    def _load_local_model(self) -> None:
        model_path = self.local_model_path.strip()
        if not model_path:
            self.get_logger().error('Local inference enabled but local_model_path is empty')
            return

        model_file = Path(model_path)
        if not model_file.exists():
            self.get_logger().error(f'Local model not found: {model_path}')
            return

        config_path = self.local_config_path.strip()
        if config_path:
            config_file = Path(config_path)
            if not config_file.exists():
                self.get_logger().error(f'Local model config not found: {config_path}')
                return
            self.net = cv2.dnn.readNet(str(model_file), str(config_file))
        else:
            self.net = cv2.dnn.readNet(str(model_file))

        labels_path = self.local_labels_path.strip()
        if labels_path:
            labels_file = Path(labels_path)
            if not labels_file.exists():
                self.get_logger().error(f'Labels file not found: {labels_path}')
            else:
                with labels_file.open("r", encoding="utf-8") as handle:
                    self.labels = [line.strip() for line in handle if line.strip()]

    def _label_for_class_id(self, class_id: int) -> str:
        if self.labels and 0 <= class_id < len(self.labels):
            return self.labels[class_id]
        if 0 <= class_id < len(COCO_LABELS):
            return COCO_LABELS[class_id]
        return str(class_id)

    def _resolve_label(self, class_id: str) -> str:
        if class_id.isdigit():
            idx = int(class_id)
            if idx < len(COCO_LABELS):
                return COCO_LABELS[idx]
        return class_id if class_id else "unknown"

    def _best_hypothesis(self, detection) -> Optional[ObjectHypothesisWithPose]:
        if not detection.results:
            return None
        best = detection.results[0]
        best_score = float(best.hypothesis.score)
        for result in detection.results[1:]:
            score = float(result.hypothesis.score)
            if score > best_score:
                best = result
                best_score = score
        return best

    def _should_keep(self, class_id: str, label: str) -> bool:
        if not self.enable_class_filter:
            return True
        if not self.target_classes:
            return True
        class_key = class_id.lower()
        label_key = label.lower()
        return class_key in self.target_classes or label_key in self.target_classes

    def _denormalize_bbox(
        self,
        cx: float,
        cy: float,
        w: float,
        h: float,
        width: Optional[int],
        height: Optional[int],
    ) -> Tuple[float, float, float, float]:
        if width and height:
            if 0.0 <= cx <= 1.0 and 0.0 <= cy <= 1.0 and w <= 2.0 and h <= 2.0:
                cx *= width
                cy *= height
                w *= width
                h *= height
        return cx, cy, w, h

    def _project_point(self, x: float, y: float, z: float) -> Optional[Tuple[float, float]]:
        if self.fx is None or self.fy is None or self.cx is None or self.cy is None:
            return None
        if z <= 0.0:
            return None
        u = self.fx * x / z + self.cx
        v = self.fy * y / z + self.cy
        return u, v

    def _project_3d_box_to_2d(self, center, size) -> Optional[Tuple[int, int, int, int]]:
        width = self.camera_width or (self.latest_image_shape[1] if self.latest_image_shape else None)
        height = self.camera_height or (self.latest_image_shape[0] if self.latest_image_shape else None)
        if width is None or height is None:
            return None

        hx = float(size.x) / 2.0
        hy = float(size.y) / 2.0
        hz = float(size.z) / 2.0

        cx = float(center.position.x)
        cy = float(center.position.y)
        cz = float(center.position.z)

        points = []
        for sx in (-hx, hx):
            for sy in (-hy, hy):
                for sz in (-hz, hz):
                    proj = self._project_point(cx + sx, cy + sy, cz + sz)
                    if proj is not None:
                        points.append(proj)

        if not points:
            return None

        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        x1 = int(max(0, min(xs)))
        y1 = int(max(0, min(ys)))
        x2 = int(min(width - 1, max(xs)))
        y2 = int(min(height - 1, max(ys)))

        if x2 <= x1 or y2 <= y1:
            return None

        return x1, y1, x2, y2

    def _bbox_from_detection(
        self,
        detection,
        width: Optional[int],
        height: Optional[int],
    ) -> Tuple[int, int, int, int]:
        cx = float(detection.bbox.center.position.x)
        cy = float(detection.bbox.center.position.y)
        w = float(detection.bbox.size_x)
        h = float(detection.bbox.size_y)

        cx, cy, w, h = self._denormalize_bbox(cx, cy, w, h, width, height)

        x1 = int(cx - w / 2.0)
        y1 = int(cy - h / 2.0)
        x2 = int(cx + w / 2.0)
        y2 = int(cy + h / 2.0)

        if width:
            x1 = max(0, min(x1, width - 1))
            x2 = max(0, min(x2, width - 1))
        if height:
            y1 = max(0, min(y1, height - 1))
            y2 = max(0, min(y2, height - 1))

        return x1, y1, x2, y2

    def _pose_meters(self, result: Optional[ObjectHypothesisWithPose]) -> Optional[Tuple[float, float, float]]:
        if result is None:
            return None
        position = result.pose.pose.position
        x = float(position.x)
        y = float(position.y)
        z = float(position.z)
        if x == 0.0 and y == 0.0 and z == 0.0:
            return None
        return x, y, z

    def on_camera_info(self, msg: CameraInfo) -> None:
        if len(msg.k) == 9:
            self.fx = float(msg.k[0])
            self.fy = float(msg.k[4])
            self.cx = float(msg.k[2])
            self.cy = float(msg.k[5])
        self.camera_width = int(msg.width)
        self.camera_height = int(msg.height)

    def on_detections(self, msg: Detection2DArray) -> None:
        if self.use_local_inference and self.net is not None:
            return
        self.latest_detections = msg
        self.publish_spatial_detections(msg)

    def on_spatial_detections(self, msg: Detection3DArray) -> None:
        if self.use_local_inference and self.net is not None:
            return
        det2d = self.convert_spatial_to_2d(msg)
        if det2d is None:
            return
        self.latest_detections = det2d
        self.detections_pub.publish(det2d)
        self.publish_spatial_detections(det2d)

    def on_image(self, msg: Image) -> None:
        try:
            frame = self.bridge.imgmsg_to_cv2(msg, desired_encoding='bgr8')
        except Exception as exc:
            self.get_logger().error(f'Failed to decode image: {exc}')
            return

        self.latest_image_shape = frame.shape[:2]

        if self.use_local_inference and self.net is not None:
            det_msg = self.run_local_inference(frame, msg.header)
            self.latest_detections = det_msg
            self.detections_pub.publish(det_msg)
            self.publish_spatial_detections(det_msg)

        annotated = self.annotate_frame(frame, self.latest_detections)
        self.publish_annotated_image(annotated, msg)

    def annotate_frame(
        self,
        frame: np.ndarray,
        detections: Optional[Detection2DArray],
    ) -> np.ndarray:
        annotated = frame.copy()
        if detections is None:
            return annotated

        height, width = annotated.shape[:2]

        for detection in detections.detections:
            best = self._best_hypothesis(detection)
            class_id = best.hypothesis.class_id if best else "unknown"
            label = self._resolve_label(class_id)
            if not self._should_keep(class_id, label):
                continue

            confidence = float(best.hypothesis.score) if best else 0.0
            x1, y1, x2, y2 = self._bbox_from_detection(detection, width, height)

            color = (0, 255, 0)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

            label_text = f"{label} {confidence:.0%}" if best else label
            cv2.putText(
                annotated,
                label_text,
                (x1, max(0, y1 - 10)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                color,
                2,
            )

            pose_m = self._pose_meters(best)
            if pose_m:
                sx, sy, sz = pose_m
                dist_m = math.sqrt(sx * sx + sy * sy + sz * sz)
                spatial_text = f"X:{sx:.2f} Y:{sy:.2f} Z:{sz:.2f}m"
                cv2.putText(
                    annotated,
                    spatial_text,
                    (x1, min(height - 5, y2 + 15)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.45,
                    (255, 255, 255),
                    1,
                )
                dist_text = f"{dist_m:.2f}m"
                cv2.putText(
                    annotated,
                    dist_text,
                    (x1, min(height - 5, y2 + 30)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (0, 200, 255),
                    2,
                )

        return annotated

    def run_local_inference(self, frame: np.ndarray, header) -> Detection2DArray:
        msg = Detection2DArray()
        msg.header = header

        height, width = frame.shape[:2]
        blob = cv2.dnn.blobFromImage(
            frame,
            scalefactor=self.local_scale,
            size=(self.local_input_width, self.local_input_height),
            mean=self.local_mean,
            swapRB=self.local_swap_rb,
            crop=False,
        )
        try:
            self.net.setInput(blob)
            detections = self.net.forward()
        except Exception as exc:
            self.get_logger().error(f'Local inference failed: {exc}')
            return msg

        if detections is None or detections.ndim != 4 or detections.shape[-1] < 7:
            self.get_logger().error('Unexpected detection output shape; expected [1,1,N,7]')
            return msg

        for idx in range(detections.shape[2]):
            confidence = float(detections[0, 0, idx, 2])
            if confidence < self.local_conf_threshold:
                continue

            class_id = int(detections[0, 0, idx, 1])
            x_min = max(0.0, min(1.0, float(detections[0, 0, idx, 3])))
            y_min = max(0.0, min(1.0, float(detections[0, 0, idx, 4])))
            x_max = max(0.0, min(1.0, float(detections[0, 0, idx, 5])))
            y_max = max(0.0, min(1.0, float(detections[0, 0, idx, 6])))

            x1 = int(x_min * width)
            y1 = int(y_min * height)
            x2 = int(x_max * width)
            y2 = int(y_max * height)

            det_msg = Detection2D()
            det_msg.bbox.center.position.x = (x1 + x2) / 2.0
            det_msg.bbox.center.position.y = (y1 + y2) / 2.0
            det_msg.bbox.size_x = max(1.0, float(x2 - x1))
            det_msg.bbox.size_y = max(1.0, float(y2 - y1))

            result = ObjectHypothesisWithPose()
            result.hypothesis.class_id = self._label_for_class_id(class_id)
            result.hypothesis.score = confidence
            det_msg.results.append(result)

            msg.detections.append(det_msg)

        return msg

    def convert_spatial_to_2d(self, msg: Detection3DArray) -> Optional[Detection2DArray]:
        if self.fx is None or self.fy is None or self.cx is None or self.cy is None:
            return None

        out = Detection2DArray()
        out.header = msg.header

        for detection in msg.detections:
            best = self._best_hypothesis(detection)
            class_id = best.hypothesis.class_id if best else "unknown"
            label = self._resolve_label(class_id)
            if not self._should_keep(class_id, label):
                continue

            bbox = self._project_3d_box_to_2d(detection.bbox.center, detection.bbox.size)
            if bbox is None:
                continue

            x1, y1, x2, y2 = bbox

            det_msg = Detection2D()
            det_msg.bbox.center.position.x = (x1 + x2) / 2.0
            det_msg.bbox.center.position.y = (y1 + y2) / 2.0
            det_msg.bbox.size_x = max(1.0, float(x2 - x1))
            det_msg.bbox.size_y = max(1.0, float(y2 - y1))

            result = ObjectHypothesisWithPose()
            result.hypothesis.class_id = label
            result.hypothesis.score = float(best.hypothesis.score) if best else 0.0
            # Use 3D center as pose for spatial info
            result.pose.pose.position.x = float(detection.bbox.center.position.x)
            result.pose.pose.position.y = float(detection.bbox.center.position.y)
            result.pose.pose.position.z = float(detection.bbox.center.position.z)
            det_msg.results.append(result)

            out.detections.append(det_msg)

        return out

    def publish_annotated_image(self, frame: np.ndarray, src_msg: Image) -> None:
        try:
            msg = self.bridge.cv2_to_imgmsg(frame, encoding='bgr8')
            msg.header = src_msg.header
            self.annotated_pub.publish(msg)
        except Exception as exc:
            self.get_logger().error(f'Failed to publish annotated image: {exc}')

    def publish_spatial_detections(self, msg: Detection2DArray) -> None:
        width = self.latest_image_shape[1] if self.latest_image_shape else None
        height = self.latest_image_shape[0] if self.latest_image_shape else None

        det_list = []
        for detection in msg.detections:
            best = self._best_hypothesis(detection)
            class_id = best.hypothesis.class_id if best else "unknown"
            label = self._resolve_label(class_id)
            if not self._should_keep(class_id, label):
                continue

            confidence = float(best.hypothesis.score) if best else 0.0
            x1, y1, x2, y2 = self._bbox_from_detection(detection, width, height)

            bbox = {
                "x_min": round(x1 / width, 4) if width else None,
                "y_min": round(y1 / height, 4) if height else None,
                "x_max": round(x2 / width, 4) if width else None,
                "y_max": round(y2 / height, 4) if height else None,
                "x_min_px": int(x1),
                "y_min_px": int(y1),
                "x_max_px": int(x2),
                "y_max_px": int(y2),
            }

            pose_m = self._pose_meters(best)
            if pose_m:
                sx, sy, sz = pose_m
                distance_m = math.sqrt(sx * sx + sy * sy + sz * sz)
                spatial_mm = {
                    "x": round(sx * 1000.0, 1),
                    "y": round(sy * 1000.0, 1),
                    "z": round(sz * 1000.0, 1),
                }
                spatial_m = {
                    "x": round(sx, 3),
                    "y": round(sy, 3),
                    "z": round(sz, 3),
                }
            else:
                spatial_mm = {"x": None, "y": None, "z": None}
                spatial_m = {"x": None, "y": None, "z": None}
                distance_m = None

            det_list.append(
                {
                    "label": label,
                    "label_id": class_id,
                    "confidence": round(confidence, 3),
                    "bbox": bbox,
                    "spatial_mm": spatial_mm,
                    "spatial_meters": spatial_m,
                    "distance_meters": round(distance_m, 3) if distance_m is not None else None,
                }
            )

        stamp = msg.header.stamp
        if stamp.sec == 0 and stamp.nanosec == 0:
            stamp = self.get_clock().now().to_msg()

        payload = {
            "timestamp": round(stamp.sec + stamp.nanosec / 1e9, 3),
            "frame_id": msg.header.frame_id,
            "detections": det_list,
        }

        out = String()
        out.data = json.dumps(payload)
        self.spatial_pub.publish(out)


def main(args=None) -> None:
    rclpy.init(args=args)

    try:
        node = OAKCameraNode()
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    main()
