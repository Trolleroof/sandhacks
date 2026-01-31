import depthai as dai
import time

def camera_test():
    """Simple camera test to verify connection"""
    try:
        # Try to create device
        device = dai.Device()
        print(f"Connected to device: {device.getMxId()}")
        
        # Get available cameras
        cameras = device.getConnectedCameras()
        print(f"Available cameras: {cameras}")
        
        # Create simple pipeline
        pipeline = dai.Pipeline()
        cam = pipeline.create(dai.node.Camera).build(
            dai.CameraBoardSocket.CAM_A, sensorFps=30.0
        )
        
        # Create output queue
        frameQueue = cam.raw.createOutputQueue()
        
        # Start pipeline
        device.startPipeline(pipeline)
        
        print("Pipeline started! Getting 10 frames...")
        
        # Get 10 frames
        for i in range(10):
            frame = frameQueue.get()
            print(f"Frame {i+1}: {frame.getWidth()}x{frame.getHeight()}")
            time.sleep(0.1)
        
        print("Camera test completed successfully!")
        
    except Exception as e:
        print(f"Camera test failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    camera_test()