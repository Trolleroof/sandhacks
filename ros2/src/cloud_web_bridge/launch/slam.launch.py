# SLAM pipeline only — expects /right/image_rect, /right/camera_info,
# /stereo/depth, and /imu to already be published (e.g. by
# spatial_detection_node launched separately).
#
# Usage:
#   ros2 launch cloud_web_bridge slam.launch.py

from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    parameters = [{
        'frame_id': 'oak-d-base-frame',
        'subscribe_rgbd': True,
        'subscribe_odom_info': True,
        'approx_sync': False,
        'wait_imu_to_init': True,
        'Grid/CellSize': '0.02',
    }]

    remappings = [('imu', '/imu/data')]

    return LaunchDescription([

        # Sync right/depth/camera_info together
        Node(
            package='rtabmap_sync', executable='rgbd_sync', output='screen',
            parameters=parameters,
            remappings=[('rgb/image', '/right/image_rect'),
                        ('rgb/camera_info', '/right/camera_info'),
                        ('depth/image', '/stereo/depth')]),

        # Compute quaternion of the IMU
        Node(
            package='imu_filter_madgwick', executable='imu_filter_madgwick_node', output='screen',
            parameters=[{'use_mag': False,
                         'world_frame': 'enu',
                         'publish_tf': False}],
            remappings=[('imu/data_raw', '/imu')]),

        # Visual odometry
        Node(
            package='rtabmap_odom', executable='rgbd_odometry', output='screen',
            parameters=parameters,
            remappings=remappings),

        # VSLAM
        Node(
            package='rtabmap_slam', executable='rtabmap', output='screen',
            parameters=parameters,
            remappings=remappings,
            arguments=['-d']),

        # Visualization
        Node(
            package='rtabmap_viz', executable='rtabmap_viz', output='screen',
            parameters=parameters,
            remappings=remappings),
    ])
