# OAK Camera ROS2 Package

ROS2 package for OAK-D camera integration with DepthAI library and real-time image classification using MobileNet-SSD.

## Features

- **Real-time RGB Camera Stream**: Publishes RGB images at configurable FPS
- **Image Classification**: Object detection using MobileNet-SSD neural network
- **Multiple Output Topics**: Raw images, camera info, detections, and annotated images
- **Configurable Parameters**: Adjust FPS, resolution, confidence thresholds via YAML config

## Dependencies

### System Requirements
- ROS2 (Humble or newer)
- Python 3.8+
- USB 3.0 port for OAK-D camera

### Python Dependencies
Install the required Python packages:

```bash
pip3 install -r requirements.txt
```

Or install individually:
```bash
pip3 install depthai opencv-python numpy
```

### Download Neural Network Model

Download the MobileNet-SSD model blob for DepthAI:

```bash
# Create cache directory
mkdir -p ~/.cache/depthai/models

# Download the model (choose one method):

# Method 1: Direct download
wget https://github.com/luxonis/depthai-python/raw/main/examples/models/mobilenet-ssd_openvino_2021.4_6shave.blob \
  -O ~/.cache/depthai/models/mobilenet-ssd_openvino_2021.4_6shave.blob

# Method 2: Clone depthai-python repo and copy models
git clone https://github.com/luxonis/depthai-python.git /tmp/depthai-python
cp /tmp/depthai-python/examples/models/*.blob ~/.cache/depthai/models/
```

## Building the Package

```bash
cd ~/sandhacks/ros2
colcon build --packages-select oak_camera
source install/setup.bash
```

## Usage

### Launch the Camera Node

Basic usage with default parameters:
```bash
ros2 launch oak_camera camera.launch.py
```

With custom parameters:
```bash
# Disable classification
ros2 launch oak_camera camera.launch.py enable_classification:=false

# Change FPS
ros2 launch oak_camera camera.launch.py camera_fps:=15

# Combine multiple parameters
ros2 launch oak_camera camera.launch.py camera_fps:=20 enable_classification:=true
```

### Run the Node Directly

```bash
ros2 run oak_camera camera_node
```

## Published Topics

| Topic | Type | Description |
|-------|------|-------------|
| `/oak/rgb/image_raw` | `sensor_msgs/Image` | Raw RGB camera feed |
| `/oak/rgb/camera_info` | `sensor_msgs/CameraInfo` | Camera calibration information |
| `/oak/nn/detections` | `vision_msgs/Detection2DArray` | Object detection results |
| `/oak/nn/image` | `sensor_msgs/Image` | Annotated image with bounding boxes |

## Configuration

Edit `config/camera_params.yaml` to modify default parameters:

```yaml
oak_camera_node:
  ros__parameters:
    camera_fps: 30                    # Camera frame rate
    preview_width: 640                # Image width
    preview_height: 480               # Image height
    enable_classification: true       # Enable/disable object detection
    confidence_threshold: 0.5         # Minimum detection confidence
    model_name: 'mobilenet-ssd'       # Neural network model name
```

## Visualization

### View Camera Feed

```bash
# View raw RGB image
ros2 run rqt_image_view rqt_image_view /oak/rgb/image_raw

# View annotated image with detections
ros2 run rqt_image_view rqt_image_view /oak/nn/image
```

### Monitor Detections

```bash
# Echo detection messages
ros2 topic echo /oak/nn/detections

# Monitor detection rate
ros2 topic hz /oak/nn/detections
```

## Detected Object Classes

The MobileNet-SSD model can detect the following 20 object classes:

- aeroplane, bicycle, bird, boat, bottle, bus, car, cat
- chair, cow, diningtable, dog, horse, motorbike, person
- pottedplant, sheep, sofa, train, tvmonitor

## Troubleshooting

### Camera Not Detected

If the camera is not detected:

1. Check USB connection (use USB 3.0 port)
2. Verify camera permissions:
   ```bash
   # Add udev rules for OAK cameras
   echo 'SUBSYSTEM=="usb", ATTRS{idVendor}=="03e7", MODE="0666"' | sudo tee /etc/udev/rules.d/80-movidius.rules
   sudo udevadm control --reload-rules && sudo udevadm trigger
   ```
3. Test camera with depthai example:
   ```bash
   python3 -c "import depthai as dai; print(dai.Device.getAllAvailableDevices())"
   ```

### Model Not Found

If you see "Model not found" warnings:

1. Ensure the model blob is downloaded to `~/.cache/depthai/models/`
2. Verify the file name matches: `mobilenet-ssd_openvino_2021.4_6shave.blob`
3. Check file permissions are readable

### Low Frame Rate

If experiencing low frame rates:

1. Reduce `camera_fps` in config
2. Decrease resolution (`preview_width`, `preview_height`)
3. Disable classification temporarily: `enable_classification: false`
4. Check CPU usage and system resources

## Integration with Existing System

To integrate with your existing `cloud_web_bridge` node:

1. The camera publishes images to `/oak/rgb/image_raw`
2. Detections are published to `/oak/nn/detections`
3. You can remap these topics in your launch files
4. Subscribe to these topics from other nodes for further processing

Example integration:
```python
# In your node
self.image_sub = self.create_subscription(
    Image,
    '/oak/rgb/image_raw',
    self.image_callback,
    10
)
```

## Architecture

The camera node follows the DepthAI pipeline pattern:

```
┌─────────────────┐
│  ColorCamera    │ (RGB at 640x480@30fps)
└────────┬────────┘
         │
         ├──────────────────────┐
         │                      │
         v                      v
┌─────────────────┐    ┌──────────────────┐
│  XLinkOut (rgb) │    │  MobileNetDetect │
└─────────────────┘    └────────┬─────────┘
                                │
                    ┌───────────┴──────────┐
                    │                      │
                    v                      v
          ┌──────────────────┐   ┌──────────────────┐
          │ XLinkOut (detect)│   │ XLinkOut (pass)  │
          └──────────────────┘   └──────────────────┘
                    │                      │
                    v                      v
              [Detections]        [Synced Frames]
```

## Performance

Expected performance on typical systems:

- **FPS**: 30fps @ 640x480 resolution
- **Detection Latency**: ~50-100ms per frame
- **CPU Usage**: ~15-25% (single core)
- **Supported Objects**: 20 classes from COCO dataset subset

## References

- [DepthAI Documentation](https://docs.luxonis.com/)
- [DepthAI ROS Integration](https://docs.luxonis.com/software-v3/depthai/ros/)
- [MobileNet-SSD Paper](https://arxiv.org/abs/1512.02325)
- [ROS2 Vision Messages](https://github.com/ros-perception/vision_msgs)

## License

MIT License
