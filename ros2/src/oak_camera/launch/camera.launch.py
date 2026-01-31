#!/usr/bin/env python3
"""
Launch file for OAK-D camera node with YOLO spatial detection

This launch file starts the OAK camera node with configurable parameters.

Usage:
    ros2 launch oak_camera camera.launch.py
    ros2 launch oak_camera camera.launch.py enable_spatial:=false
    ros2 launch oak_camera camera.launch.py yolo_confidence_threshold:=0.7
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
    enable_spatial_arg = DeclareLaunchArgument(
        'enable_spatial',
        default_value='true',
        description='Enable YOLO spatial detection with stereo depth'
    )

    camera_fps_arg = DeclareLaunchArgument(
        'camera_fps',
        default_value='30',
        description='Camera frames per second'
    )

    confidence_arg = DeclareLaunchArgument(
        'yolo_confidence_threshold',
        default_value='0.5',
        description='YOLO detection confidence threshold'
    )

    depth_lower_arg = DeclareLaunchArgument(
        'depth_lower_threshold',
        default_value='100',
        description='Minimum depth in mm for spatial calculations'
    )

    depth_upper_arg = DeclareLaunchArgument(
        'depth_upper_threshold',
        default_value='10000',
        description='Maximum depth in mm for spatial calculations'
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
                'enable_spatial': LaunchConfiguration('enable_spatial'),
                'camera_fps': LaunchConfiguration('camera_fps'),
                'yolo_confidence_threshold': LaunchConfiguration('yolo_confidence_threshold'),
                'depth_lower_threshold': LaunchConfiguration('depth_lower_threshold'),
                'depth_upper_threshold': LaunchConfiguration('depth_upper_threshold'),
            }
        ],
        remappings=[]
    )

    return LaunchDescription([
        enable_spatial_arg,
        camera_fps_arg,
        confidence_arg,
        depth_lower_arg,
        depth_upper_arg,
        camera_node,
    ])
