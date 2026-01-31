import depthai as dai
import cv2
import numpy as np

def camera_with_display():
    """Camera setup with display output"""
    device = dai.Device()

    with dai.Pipeline(device) as pipeline:
        # Create camera node
        cam = pipeline.create(dai.node.Camera).build()
        
        # Create output queue for frames
        frameQueue = cam.raw.createOutputQueue()
        
        # Start pipeline
        pipeline.start()
        
        print("Camera with display started! Press 'q' to quit.")
        
        while pipeline.isRunning():
            # Get frame
            frame = frameQueue.get()
            
            # Convert to numpy array for OpenCV display
            frame_np = frame.getCvFrame()
            
            # Display the frame
            cv2.imshow('Luxonis Camera', frame_np)
            
            # Check for quit key
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
        
        cv2.destroyAllWindows()

if __name__ == "__main__":
    camera_with_display()