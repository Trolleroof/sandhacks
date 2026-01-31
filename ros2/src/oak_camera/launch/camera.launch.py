#!/usr/bin/env python3
"""
Launch file for OAK-D camera with object detection.

Uses the official depthai_ros_driver for camera connection and neural network
inference, plus a lightweight annotation node that draws bounding boxes on
the image and republishes it.

Usage:
    ros2 launch oak_camera camera.launch.py
    ros2 launch oak_camera camera.launch.py name:=oak camera_model:=OAK-D-PRO
"""

import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    depthai_prefix = get_package_share_directory('depthai_ros_driver')
    oak_camera_prefix = get_package_share_directory('oak_camera')

    # --- Launch arguments ---------------------------------------------------
    name_arg = DeclareLaunchArgument('name', default_value='oak')
    camera_model_arg = DeclareLaunchArgument(
        'camera_model', default_value='OAK-D-PRO')
    params_file_arg = DeclareLaunchArgument(
        'params_file',
        default_value=os.path.join(depthai_prefix, 'config', 'camera.yaml'),
    )

    # --- Include the official depthai_ros_driver launch ---------------------
    depthai_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            os.path.join(depthai_prefix, 'launch', 'camera.launch.py')
        ),
        launch_arguments={
            'name': LaunchConfiguration('name'),
            'camera_model': LaunchConfiguration('camera_model'),
            'params_file': LaunchConfiguration('params_file'),
        }.items(),
    )

    # --- Annotation node (draws bounding boxes on the image) ----------------
    annotation_node = Node(
        package='oak_camera',
        executable='camera_node',
        name='oak_annotation_node',
        output='screen',
        parameters=[
            os.path.join(oak_camera_prefix, 'config', 'camera_params.yaml'),
        ],
        remappings=[
            # Subscribe to depthai_ros_driver topics
            ('~/image_in', '/oak/rgb/image_raw'),
            ('~/detections_in', '/oak/nn/detections'),
            # Publish annotated output
            ('~/image_out', '/oak/nn/image'),
        ],
    )

    return LaunchDescription([
        name_arg,
        camera_model_arg,
        params_file_arg,
        depthai_launch,
        annotation_node,
    ])
