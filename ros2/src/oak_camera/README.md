# OAK Camera Annotation ROS2 Package

This package provides a lightweight annotation + local inference node that
overlays detections on RGB frames and publishes:

- `/oak/nn/image` (annotated image stream)
- `/oak/spatial/detections` (JSON with spatial coords when provided)

The camera stream is handled by `depthai_ros_driver`. This node can either:
1) Annotate detections produced by `depthai_ros_driver`, or
2) Run local CPU inference (OpenCV DNN) and publish `/oak/nn/detections` itself.

## Architecture

1. `depthai_ros_driver` publishes:
   - `/oak/rgb/image_raw`
2. `oak_camera` runs local inference (default) and publishes:
   - `/oak/nn/detections`
   - `/oak/nn/image`
   - `/oak/spatial/detections`

When `depthai_ros_driver` publishes `/oak/nn/spatial_detections` only, this node
subscribes to that topic and converts 3D detections into 2D boxes for
`/oak/nn/detections` and annotation.

## Dependencies

- ROS2 (Humble or newer)
- `depthai_ros_driver`
- Python: `opencv-python`, `numpy`

## Build

```bash
cd /home/chei/Desktop/sandhacks/ros2
colcon build --packages-select oak_camera
source install/setup.bash
```

## Run

Start the driver (uses `config/depthai_camera.yaml` to disable on-device NN):
```bash
ros2 launch oak_camera camera.launch.py
```

Start the annotation node in another terminal:
```bash
source /home/chei/Desktop/sandhacks/ros2/install/setup.bash
ros2 run oak_camera camera_node
```

Optional parameters:
```bash
ros2 run oak_camera camera_node --ros-args \
  --params-file /home/chei/Desktop/sandhacks/ros2/src/oak_camera/config/camera_params.yaml
```

## Topics

### Subscribed
- `/oak/rgb/image_raw` (sensor_msgs/Image)
- `/oak/nn/detections` (vision_msgs/Detection2DArray)
- `/oak/nn/spatial_detections` (vision_msgs/Detection3DArray)

### Published
- `/oak/nn/image` (sensor_msgs/Image) — annotated
- `/oak/spatial/detections` (std_msgs/String) — JSON

## Local Inference Model Files

Local inference uses OpenCV DNN. Place model files in
`ros2/src/oak_camera/models/`:

- `mobilenet_ssd.caffemodel`
- `mobilenet_ssd.prototxt`
- `mobilenet_ssd.labels` (already provided)

Update paths in `ros2/src/oak_camera/config/camera_params.yaml` if you use a
different model.

## Filtering

Use `enable_class_filter` + `target_classes` to filter detections by class ID
or label name (case-insensitive). When `enable_class_filter` is false, all
detections pass through.
