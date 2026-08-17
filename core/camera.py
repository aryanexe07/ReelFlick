"""
Camera module for webcam handling.
Provides camera detection, initialization, and frame capture with graceful error handling.
"""

import cv2
import logging
from typing import Optional, Tuple
from threading import Lock
import time

logger = logging.getLogger(__name__)


class Camera:
    """Handles webcam capture with automatic detection and error recovery."""
    
    def __init__(self, camera_id: int = 0):
        """
        Initialize camera with specified ID.
        
        Args:
            camera_id: Camera device ID (default: 0)
        """
        self.camera_id = camera_id
        self.cap: Optional[cv2.VideoCapture] = None
        self._lock = Lock()
        self._is_running = False
        self._fps = 0
        self._frame_count = 0
        self._last_time = time.time()
        self._width = 640
        self._height = 480
        
    @staticmethod
    def list_available_cameras(max_cameras: int = 10) -> list[int]:
        """
        Detect all available cameras.
        
        Args:
            max_cameras: Maximum number of cameras to check
            
        Returns:
            List of available camera IDs
        """
        available = []
        for i in range(max_cameras):
            cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
            if cap.isOpened():
                available.append(i)
                cap.release()
        return available
    
    def start(self) -> bool:
        """
        Start camera capture.
        
        Returns:
            True if camera started successfully, False otherwise
        """
        with self._lock:
            if self._is_running:
                logger.warning("Camera already running")
                return True
                
            try:
                self.cap = cv2.VideoCapture(self.camera_id, cv2.CAP_DSHOW)
                
                if not self.cap.isOpened():
                    logger.error(f"Failed to open camera {self.camera_id}")
                    return False
                
                # Set optimal settings
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self._width)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self._height)
                self.cap.set(cv2.CAP_PROP_FPS, 30)
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                
                # Verify settings
                actual_width = self.cap.get(cv2.CAP_PROP_FRAME_WIDTH)
                actual_height = self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
                
                self._width = int(actual_width)
                self._height = int(actual_height)
                
                self._is_running = True
                self._frame_count = 0
                self._last_time = time.time()
                
                logger.info(f"Camera {self.camera_id} started: {self._width}x{self._height}")
                return True
                
            except Exception as e:
                logger.error(f"Error starting camera: {e}")
                if self.cap:
                    self.cap.release()
                    self.cap = None
                return False
    
    def stop(self) -> None:
        """Stop camera capture."""
        with self._lock:
            if not self._is_running:
                return
                
            self._is_running = False
            
            if self.cap:
                self.cap.release()
                self.cap = None
                
            logger.info("Camera stopped")
    
    def read_frame(self) -> Optional[Tuple[bool, any]]:
        """
        Read a frame from the camera.
        
        Returns:
            Tuple of (success, frame) or None if camera not running
        """
        with self._lock:
            if not self._is_running or not self.cap:
                return None
            
            try:
                success, frame = self.cap.read()
                
                if not success or frame is None:
                    logger.warning("Failed to read frame")
                    return (False, None)
                
                # Calculate FPS
                self._frame_count += 1
                current_time = time.time()
                elapsed = current_time - self._last_time
                
                if elapsed >= 1.0:
                    self._fps = self._frame_count / elapsed
                    self._frame_count = 0
                    self._last_time = current_time
                
                return (True, frame)
                
            except Exception as e:
                logger.error(f"Error reading frame: {e}")
                return (False, None)
    
    def is_running(self) -> bool:
        """Check if camera is running."""
        with self._lock:
            return self._is_running
    
    def get_fps(self) -> float:
        """Get current FPS."""
        return self._fps
    
    def get_resolution(self) -> Tuple[int, int]:
        """Get current resolution."""
        return (self._width, self._height)
    
    def set_camera_id(self, camera_id: int) -> bool:
        """
        Change camera ID.
        
        Args:
            camera_id: New camera ID
            
        Returns:
            True if successful, False otherwise
        """
        was_running = self.is_running()
        
        if was_running:
            self.stop()
        
        self.camera_id = camera_id
        
        if was_running:
            return self.start()
        
        return True
    
    def __del__(self):
        """Cleanup on deletion."""
        self.stop()
