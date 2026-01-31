Great clarifications. Below is an updated **clean, implementable plan** that:

* Keeps the **filtering framework in place**, but **no filtering enabled initially**
* Adds **camera pose** and **trajectory/path**
* Exposes **point cloud + pose + path** through a **single, coherent web-facing API**
* Stays aligned with **RTAB-Map + OAK-D Pro W PoE + ROS 2**

I’ll keep this architectural and concrete, not hand-wavy.

---

## 1. Updated System Architecture

```
OAK-D Pro W PoE
   ↓
rtabmap_examples depthai.launch.py
   ↓
RTAB-Map (ROS2)
   ├── /cloud_ground        (PointCloud2, RGB)
   ├── /rtabmap/mapData
   ├── /odom                (nav_msgs/Odometry)
   ├── /rtabmap/odom        (nav_msgs/Odometry)
   └── /rtabmap/mapPath     (nav_msgs/Path)
            ↓
[ cloud_web_bridge_node ]   ← your node
   ├── subscribes:
   │     /cloud_ground
   │     /rtabmap/odom
   │     /rtabmap/mapPath
   ├── (filtering pipeline – currently pass-through)
   ├── rate limiting (1–3 Hz)
   ├── repackaging
   ├── publishes:
   │     /web/pointcloud
   │     /web/pose
   │     /web/path
            ↓
rosbridge_server
            ↓
Three.js frontend (single WS connection)
```

---

## 2. Data You Will Expose (Web API Contract)

You will expose **three synchronized data streams**:

| Data         | ROS Topic          | Web Topic         |
| ------------ | ------------------ | ----------------- |
| Point cloud  | `/cloud_ground`    | `/web/pointcloud` |
| Current pose | `/rtabmap/odom`    | `/web/pose`       |
| Camera path  | `/rtabmap/mapPath` | `/web/path`       |

> These are **read-only**, streaming, push-based APIs.

---

## 3. Filtering Framework (Disabled by Default)

### Design Principle

Filtering should be **configurable, not hardcoded**.

### Internal pipeline (C++ pseudocode)

```cpp
PointCloud2 input_cloud;

if (enable_voxel_)
  cloud = applyVoxelGrid(cloud);

if (enable_passthrough_)
  cloud = applyPassThrough(cloud);

if (enable_outlier_)
  cloud = applyOutlierRemoval(cloud);
```

### Initial parameters

```yaml
enable_voxel: false
enable_passthrough: false
enable_outlier: false
publish_rate_hz: 2.0
```

Result:

* **No modification to RTAB-Map output**
* Framework ready for future toggles

---

## 4. Pose Handling (Camera Pose)

### ROS input

Use:

```text
/rtabmap/odom   (nav_msgs/Odometry)
```

This gives:

* Position
* Orientation (quaternion)
* Continuous pose (not loop-closed jumps like `/map`)

### What to publish to the web

#### Web Pose Message

```json
{
  "timestamp": 1700000000.123,
  "position": { "x": 1.2, "y": 0.4, "z": 0.9 },
  "orientation": { "x": 0.0, "y": 0.0, "z": 0.38, "w": 0.92 }
}
```

### ROS output

You can either:

* Publish raw `nav_msgs/Odometry`, or
* Convert to JSON string (`std_msgs/String`) for web simplicity

👉 **Recommendation**: JSON string for web-facing topics.

---

## 5. Path / Trajectory Handling

### ROS input

RTAB-Map publishes:

```text
/rtabmap/mapPath   (nav_msgs/Path)
```

This contains:

* Entire optimized trajectory
* Updated after loop closures

### Web representation

```json
{
  "frame_id": "map",
  "poses": [
    { "x": 0.0, "y": 0.0, "z": 0.0 },
    { "x": 0.1, "y": 0.0, "z": 0.0 },
    { "x": 0.2, "y": 0.1, "z": 0.0 }
  ]
}
```

### Rate strategy

* Path updates **≤ 1 Hz**
* Only resend if path length changed or loop closure occurred

---

## 6. Point Cloud Handling (No Filtering Yet)

### ROS input

```text
/cloud_ground   (sensor_msgs/PointCloud2)
```

### Behavior

* Pass-through by default
* Optionally downsample later
* Throttled publish rate (1–3 Hz)

### Web encoding options

#### Option A (Recommended): Binary JSON (Base64)

```json
{
  "frame_id": "map",
  "point_stride": 16,
  "points_b64": "AAABAAEA..."
}
```

#### Option B (MVP only): Array of points

```json
{
  "points": [
    [x, y, z, r, g, b],
    ...
  ]
}
```

⚠️ Option B will not scale.

---

## 7. Synchronization Strategy

You **do not need exact time sync** initially.

Strategy:

* Publish each stream independently
* Include timestamps
* Frontend uses *latest available* data

Later upgrade:

* Bundle pose + cloud in one message
* Or approximate sync with message filters

---

## 8. rosbridge Exposure

Launch:

```bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```

Web subscribes to:

```json
{
  "op": "subscribe",
  "topic": "/web/pointcloud"
}
```

```json
{
  "op": "subscribe",
  "topic": "/web/pose"
}
```

```json
{
  "op": "subscribe",
  "topic": "/web/path"
}
```

---

## 9. Three.js Visualization Mapping

### Scene objects

| ROS data    | Three.js                             |
| ----------- | ------------------------------------ |
| Point cloud | `THREE.Points`                       |
| Pose        | `THREE.AxesHelper` or camera frustum |
| Path        | `THREE.Line`                         |

### Coordinate conversion

ROS → Three.js:

```
(x, y, z) → (x, z, -y)
```

---

## 10. Node Responsibilities Summary

### `cloud_web_bridge_node`

* [x] Subscribe to RTAB-Map outputs
* [x] Pass-through filtering pipeline
* [x] Throttle publish rates
* [x] Convert ROS → Web-friendly messages
* [x] Publish pose, path, and cloud
* [x] Stateless, restart-safe

---

## 11. Clean Next Steps

If you want, next I can:

1. Provide a **ROS2 C++ node skeleton** with all subscribers/publishers
2. Define a **single unified JSON schema** (cloud + pose + path)
3. Sketch the **Three.js update loop**
4. Recommend **RTAB-Map params specifically for OAK-D Pro PoE**

Just tell me which one you want next.
