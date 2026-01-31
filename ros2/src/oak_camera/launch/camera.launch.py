#!/usr/bin/env python3
"""
Launch file for OAK-D camera node with image classification

This launch file starts the OAK camera node with configurable parameters.

Usage:
    ros2 launch oak_camera camera.launch.py
    ros2 launch oak_camera camera.launch.py enable_classification:=false
"""

import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    # Get package directory
    pkg_dir = get_package_share_directory('oak_camera')
    config_file = os.path.join(pkg_dir, 'config', 'camera_params.yaml')

    # Declare launch arguments
    enable_classification_arg = DeclareLaunchArgument(
        'enable_classification',
        default_value='true',
        description='Enable image classification'
    )

    camera_fps_arg = DeclareLaunchArgument(
        'camera_fps',
        default_value='30',
        description='Camera frames per second'
    )

    # Camera node
    camera_node = Node(
        package='oak_camera',
        executable='camera_node',
        name='oak_camera_node',
        output='screen',
        parameters=[
            config_file,
            {
                'enable_classification': LaunchConfiguration('enable_classification'),
                'camera_fps': LaunchConfiguration('camera_fps'),
            }
        ],
        remappings=[
            # Remap topics if needed
        ]
    )

    return LaunchDescription([
        enable_classification_arg,
        camera_fps_arg,
        camera_node,
    ])
