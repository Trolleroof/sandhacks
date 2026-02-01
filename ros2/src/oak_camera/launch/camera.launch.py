#!/usr/bin/env python3
import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource


def generate_launch_description():
    depthai_prefix = get_package_share_directory('depthai_ros_driver')
    oak_prefix = get_package_share_directory('oak_camera')
    params_file = os.path.join(oak_prefix, 'config', 'depthai_camera.yaml')

    # Launch the official depthai_ros_driver
    depthai_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            os.path.join(depthai_prefix, 'launch', 'camera.launch.py')
        ),
        launch_arguments={
            'name': 'oak',
            'camera_model': 'OAK-D-PRO',
            'params_file': params_file,
        }.items(),
    )

    return LaunchDescription([depthai_launch])
