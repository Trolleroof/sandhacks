from launch import LaunchDescription
from launch_ros.actions import Node


BLOB_PATH = "/opt/ros/humble/share/depthai_examples/resources/yolov4_tiny_coco_416x416_openvino_2021.4_6shave_bgr.blob"


def generate_launch_description():
    return LaunchDescription([
        Node(
            package="spatial_detection",
            executable="spatial_detection_node",
            output="screen",
            parameters=[{
                "blob_path": BLOB_PATH,
                "confidence_threshold": 0.5,
                "iou_threshold": 0.5,
                "sync_nn": True,
                "depth_lower_threshold": 100,
                "depth_upper_threshold": 5000,
            }],
        ),
    ])
