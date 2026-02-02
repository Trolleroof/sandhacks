# Reality Memory

A spatial memory assistant that helps you find objects in your environment using computer vision and 3D mapping.

## What It Does

- **Map your space** — Walk around with a camera to build a 3D map of your environment
- **Detect objects** — Automatically recognizes and remembers object locations using YOLOv8
- **Find things** — Ask "Where are my keys?" and get voice-guided directions to the object

## Tech Stack

**Frontend**: Next.js, React Three Fiber, Tailwind CSS  
**Backend**: ROS2, OpenCV, ONNX Runtime (YOLOv8)  
**APIs**: Cerebras (LLM), ElevenLabs (TTS)

## Quick Start

### Frontend
```bash
cd frontend/app
npm install
npm run dev
```

### ROS2 Backend
```bash
cd ros2
colcon build
source install/setup.bash
ros2 launch cloud_web_bridge depthai.launch.py
```

## Environment Variables

Create `frontend/app/.env.local`:
```
CEREBRAS_API_KEY=your_key
ELEVENLABS_API_KEY=your_key
NEXT_PUBLIC_ROSBRIDGE_URL=ws://localhost:9090
```

## Project Structure

```
├── frontend/app/     # Next.js web app
└── ros2/src/         # ROS2 packages
    ├── cloud_web_bridge/    # WebSocket bridge
    ├── depth_mapping/       # Spatial recognition
    └── luxonis_camera/      # Camera driver
```

## Demo Video
[![IMAGE ALT TEXT HERE](https://img.youtube.com/vi/WG91Xdzazvk/0.jpg)](https://www.youtube.com/watch?v=WG91Xdzazvk)
## License

MIT
