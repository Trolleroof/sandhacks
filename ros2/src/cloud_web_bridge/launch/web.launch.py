import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    params_file = os.path.join(
        get_package_share_directory("cloud_web_bridge"),
        "config",
        "params.yaml",
    )

    return LaunchDescription(
        [
            Node(
                package="cloud_web_bridge",
                executable="cloud_web_bridge_node",
                name="cloud_web_bridge_node",
                parameters=[params_file],
                output="screen",
            ),
            Node(
                package="rosbridge_server",
                executable="rosbridge_websocket",
                name="rosbridge_websocket",
                parameters=[{"max_message_size": 50_000_000}],
                output="screen",
            ),
        ]
    )
