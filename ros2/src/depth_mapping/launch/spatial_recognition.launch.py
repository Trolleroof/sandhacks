from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    return LaunchDescription([
        Node(
            package="depth_mapping",
            executable="spatial_recognition_node",
            output="screen",
            parameters=[{
                "confidence_threshold": 0.4,
                "min_depth": 0.2,
                "max_depth": 6.0,
                "depth_method": "median",
                "model_path": "/models/yolov8n.onnx",
                "publish_markers": True,
                "max_queue_size": 3,
            }],
        ),
    ])
