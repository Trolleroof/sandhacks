import os
import time
import depthai as dai


def wait_for_device(max_attempts: int = 10, pause: float = 2.0) -> dai.Device | None:
    """
    Find and connect to the first available DepthAI device.

    Uses DeviceBootloader discovery so we can see devices that are still in
    bootloader state (common on PoE / TCP cameras).
    """
    print("Searching for devices...")
    for attempt in range(1, max_attempts + 1):
        try:
            candidates = []

            try:
                bl_devices = dai.DeviceBootloader.getAllAvailableDevices()
            except Exception as e:
                print(f"[scan {attempt}] bootloader scan error: {e}")
                bl_devices = []

            try:
                app_devices = dai.Device.getAllAvailableDevices()
            except Exception as e:
                print(f"[scan {attempt}] application scan error: {e}")
                app_devices = []

            seen = set()
            for src, devs in (("bootloader", bl_devices), ("application", app_devices)):
                print(f"[scan {attempt}] {src} sees {len(devs)} device(s)")
                for info in devs:
                    name = getattr(info, "name", None) or getattr(info, "getName", lambda: None)()
                    mxid = getattr(info, "mxid", None)
                    if mxid is None and hasattr(info, "getMxId"):
                        try:
                            mxid = info.getMxId()
                        except Exception:
                            mxid = None
                    key = (name, mxid)
                    if key in seen:
                        continue
                    seen.add(key)
                    candidates.append(info)

            # Add a forced target IP last, only if not already queued.
            target_ip = os.getenv("TARGET_DEVICE_IP", "169.254.1.222")
            if target_ip:
                target_key = ("ip", target_ip)
                if target_key not in seen:
                    try:
                        candidates.append(dai.DeviceInfo(target_ip))
                    except Exception:
                        pass

            for info in candidates:
                state = str(info.state).split("X_LINK_")[-1] if hasattr(info, "state") else "UNKNOWN"
                proto = info.protocol.name if hasattr(info, "protocol") else "UNKNOWN"
                name = getattr(info, "name", None) or getattr(info, "getName", lambda: None)() or "?"
                mxid = getattr(info, "mxid", None)
                if mxid is None and hasattr(info, "getMxId"):
                    try:
                        mxid = info.getMxId()
                    except Exception:
                        mxid = "?"
                print(f"  - trying {name} ({mxid}) state={state} protocol={proto} raw={info}")
                try:
                    device = dai.Device(info)
                    print(f"Connected to {info.name} | mxid={device.getMxId()} platform={device.getPlatformAsString()}")
                    device.setLogLevel(dai.LogLevel.DEBUG)
                    return device
                except Exception as e:
                    print(f"    connection failed: {e}")

        except Exception as e:
            print(f"Scan error: {e}")

        print(f"Waiting {pause:.1f}s before retry...")
        time.sleep(pause)

    print("No devices found after maximum attempts.")
    return None


def build_pipeline() -> tuple[dai.Pipeline, object]:
    """
    Build a minimal RGB pipeline that works on Myriad X devices.

    We stick to ColorCamera (supported on RVC2) instead of the newer generic
    Camera node that targets RVC4.
    """
    pipeline = dai.Pipeline()

    cam = pipeline.create(dai.node.ColorCamera)
    cam.setBoardSocket(dai.CameraBoardSocket.CAM_A)
    cam.setResolution(dai.ColorCameraProperties.SensorResolution.THE_1080_P)
    cam.setFps(30)

    # Host queue straight from the video output.
    frame_queue = cam.video.createOutputQueue(maxSize=2, blocking=False)

    return pipeline, frame_queue


def run_camera() -> bool:
    device = wait_for_device()
    if not device:
        return False

    pipeline, frame_queue = build_pipeline()

    try:
        print("Starting pipeline...")
        device.startPipeline(pipeline)
        print("Pipeline started! Reading up to 5 frames (3s timeout each)...")

        received = 0
        while received < 5 and device.isPipelineRunning():
            frame = frame_queue.get(timeout=3000)  # ms
            if frame is None:
                print("  timeout waiting for frame - no data from camera")
                continue

            received += 1
            print(f"  frame {received}: {frame.getWidth()}x{frame.getHeight()}")

        if received == 0:
            print("No frames received; check lens cover, cabling, and power.")
            return False

        print("Camera test successful!")
        return True

    except Exception as e:
        print(f"Pipeline error: {e}")
        return False
    finally:
        device.close()


if __name__ == "__main__":
    success = run_camera()
    if success:
        print("✓ Camera is working!")
    else:
        print("✗ Camera setup failed")
