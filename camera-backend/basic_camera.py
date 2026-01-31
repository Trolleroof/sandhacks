import depthai as dai

def basic_camera_setup():
    """Basic camera setup for Luxonis DepthAI"""
    with dai.Pipeline() as pipeline:
        # Create a camera node
        cam = pipeline.create(dai.node.Camera).build(
            dai.CameraBoardSocket.CAM_A, sensorFps=30.0
        )
        
        # Create an output queue to get frames
        rawQueue = cam.raw.createOutputQueue()
        
        # Start the pipeline
        pipeline.start()
        
        print("Camera started! Getting frames...")
        
        # Get frames in a loop
        try:
            while True:
                frame = rawQueue.get()
                print(f"Got a frame! Size: {frame.getWidth()}x{frame.getHeight()}")
        except KeyboardInterrupt:
            print("\nStopping camera...")

if __name__ == "__main__":
    basic_camera_setup()