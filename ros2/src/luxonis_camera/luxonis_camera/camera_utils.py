"""Utilities for connecting to Luxonis DepthAI cameras."""

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

    frame_queue = cam.video.createOutputQueue(maxSize=2, blocking=False)

    return pipeline, frame_queue
