# Luxonis Camera ROS2 Node

ROS2 package for Luxonis DepthAI camera integration.

## Overview

This package publishes camera frames from a Luxonis DepthAI camera as ROS2 Image messages.

## Topics

### Published
- `/camera/image_raw` (sensor_msgs/Image) - Raw camera frames in BGR8 format

## Parameters

- `publish_rate_hz` (double, default: 30.0) - Frame publishing rate
- `frame_id` (string, default: "camera_frame") - Frame ID for image messages

## Dependencies

### System Dependencies
```bash
sudo apt install ros-${ROS_DISTRO}-cv-bridge
```

### Python Dependencies
```bash
pip install depthai opencv-python numpy
```

## Building

```bash
cd /home/chei/Desktop/sandhacks/ros2
colcon build --packages-select luxonis_camera
source install/setup.bash
```

## Running

### Launch the camera node
```bash
ros2 launch luxonis_camera camera.launch.py
```

### Run the node directly
```bash
ros2 run luxonis_camera camera_node
```

### With custom parameters
```bash
ros2 run luxonis_camera camera_node --ros-args \
  -p publish_rate_hz:=15.0 \
  -p frame_id:=luxonis_camera
```

## Environment Variables

- `TARGET_DEVICE_IP` (default: "169.254.1.222") - IP address for PoE/TCP cameras

## Original Camera Backend Files

The original camera backend scripts have been migrated into this ROS2 package:
- `basic_camera.py` → Integrated into `camera_node.py`
- `camera_display.py` → Use `rqt_image_view` instead
- `connect_camera.py` → Migrated to `camera_utils.py`
