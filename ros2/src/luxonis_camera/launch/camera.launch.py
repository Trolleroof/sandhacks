"""Launch file for Luxonis camera node."""

from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    """Generate launch description for camera node."""
    return LaunchDescription([
        Node(
            package='luxonis_camera',
            executable='camera_node',
            name='luxonis_camera_node',
            output='screen',
            parameters=[{
                'publish_rate_hz': 30.0,
                'frame_id': 'camera_frame',
            }]
        )
    ])
