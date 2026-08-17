"""
Hand tracking module using optical flow for motion detection.
Provides real-time hand motion tracking as a fallback for MediaPipe compatibility issues.
"""

import cv2
import numpy as np
import logging
from typing import Optional, Dict, List, Tuple
from dataclasses import dataclass
from threading import Lock

logger = logging.getLogger(__name__)


@dataclass
class HandLandmarks:
    """Data class for hand landmarks."""
    palm_center: Tuple[float, float]
    wrist: Tuple[float, float]
    index_tip: Tuple[float, float]
    thumb_tip: Tuple[float, float]
    index_mcp: Tuple[float, float]
    middle_mcp: Tuple[float, float]
    ring_mcp: Tuple[float, float]
    pinky_mcp: Tuple[float, float]
    all_landmarks: List[Tuple[float, float]]
    confidence: float


class HandTracker:
    """Tracks hand landmarks using MediaPipe Hands."""
    
    # MediaPipe hand landmark indices
    WRIST = 0
    THUMB_CMC = 1
    THUMB_IP = 2
    THUMB_TIP = 4
    INDEX_MCP = 5
    INDEX_PIP = 6
    INDEX_DIP = 7
    INDEX_TIP = 8
    MIDDLE_MCP = 9
    MIDDLE_TIP = 12
    RING_MCP = 13
    RING_TIP = 16
    PINKY_MCP = 17
    PINKY_TIP = 20
    
    def __init__(self, min_detection_confidence: float = 0.7, 
                 min_tracking_confidence: float = 0.5,
                 max_hands: int = 1):
        """
        Initialize hand tracker using motion detection.
        
        Args:
            min_detection_confidence: Minimum confidence for motion detection (threshold)
            min_tracking_confidence: Minimum confidence for tracking
            max_hands: Maximum number of hands to track (not used in motion mode)
        """
        self.min_detection_confidence = min_detection_confidence
        self.min_tracking_confidence = min_tracking_confidence
        self.max_hands = max_hands
        self._lock = Lock()
        
        # Previous frame for motion detection
        self.prev_frame = None
        self.prev_gray = None
        
        # Motion detection parameters
        self.motion_threshold = min_detection_confidence * 50  # Scale for pixel difference
        
        # Previous landmarks for velocity calculation
        self._prev_landmarks: Optional[HandLandmarks] = None
        self._prev_time: Optional[float] = None
        
        logger.info("Motion-based hand tracker initialized (MediaPipe compatibility fallback)")
    
    def process_frame(self, frame: np.ndarray) -> Tuple[Optional[HandLandmarks], np.ndarray]:
        """
        Process a frame to detect motion using frame differencing.
        
        Args:
            frame: Input BGR image
            
        Returns:
            Tuple of (hand landmarks, annotated frame)
        """
        if frame is None:
            return None, frame
        
        annotated_frame = frame.copy()
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        hand_landmarks = None
        
        if self.prev_gray is not None:
            # Calculate frame difference
            diff = cv2.absdiff(self.prev_gray, gray)
            _, thresh = cv2.threshold(diff, self.motion_threshold, 255, cv2.THRESH_BINARY)
            
            # Find contours of motion
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if contours:
                # Find the largest contour (likely the hand)
                largest_contour = max(contours, key=cv2.contourArea)
                if cv2.contourArea(largest_contour) > 500:  # Minimum area threshold
                    # Get bounding box
                    x, y, w, h = cv2.boundingRect(largest_contour)
                    
                    # Draw bounding box
                    cv2.rectangle(annotated_frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
                    
                    # Calculate center of motion
                    center_x = x + w // 2
                    center_y = y + h // 2
                    
                    # Create pseudo landmarks based on motion center
                    hand_landmarks = self._create_motion_landmarks(center_x, center_y, frame.shape)
                    
                    # Draw center point
                    cv2.circle(annotated_frame, (center_x, center_y), 5, (0, 0, 255), -1)
                    
                    # Update previous landmarks
                    with self._lock:
                        self._prev_landmarks = hand_landmarks
                        import time
                        self._prev_time = time.time()
                else:
                    # Clear previous landmarks if no significant motion
                    with self._lock:
                        self._prev_landmarks = None
                        self._prev_time = None
            else:
                # Clear previous landmarks if no motion
                with self._lock:
                    self._prev_landmarks = None
                    self._prev_time = None
        
        # Update previous frame
        self.prev_gray = gray
        
        return hand_landmarks, annotated_frame
    
    def _create_motion_landmarks(self, center_x: int, center_y: int, 
                                  frame_shape: Tuple[int, int, int]) -> HandLandmarks:
        """
        Create pseudo landmarks based on motion center.
        
        Args:
            center_x: X coordinate of motion center
            center_y: Y coordinate of motion center
            frame_shape: Frame shape (height, width, channels)
            
        Returns:
            HandLandmarks object with pseudo landmarks
        """
        height, width = frame_shape[:2]
        
        # Create pseudo landmarks centered around motion
        # This is a simplified representation for motion-based tracking
        palm_center = (float(center_x), float(center_y))
        wrist = (float(center_x), float(center_y + 50))
        thumb_tip = (float(center_x - 30), float(center_y - 20))
        index_tip = (float(center_x + 30), float(center_y - 40))
        index_mcp = (float(center_x + 20), float(center_y))
        middle_mcp = (float(center_x + 10), float(center_y + 10))
        ring_mcp = (float(center_x), float(center_y + 20))
        pinky_mcp = (float(center_x - 10), float(center_y + 30))
        
        # Create pseudo all_landmarks (21 points spread around center)
        all_landmarks = []
        for i in range(21):
            angle = (i / 21) * 2 * 3.14159
            radius = 30
            lx = center_x + radius * 0.5 * (i % 3) * (1 if i % 2 == 0 else -1)
            ly = center_y + radius * 0.5 * ((i // 3) % 3)
            all_landmarks.append((float(lx), float(ly)))
        
        return HandLandmarks(
            palm_center=palm_center,
            wrist=wrist,
            index_tip=index_tip,
            thumb_tip=thumb_tip,
            index_mcp=index_mcp,
            middle_mcp=middle_mcp,
            ring_mcp=ring_mcp,
            pinky_mcp=pinky_mcp,
            all_landmarks=all_landmarks,
            confidence=1.0
        )
    
    def get_previous_landmarks(self) -> Optional[HandLandmarks]:
        """Get previous frame landmarks."""
        with self._lock:
            return self._prev_landmarks
    
    def calculate_velocity(self, current: HandLandmarks) -> Optional[Tuple[float, float]]:
        """
        Calculate velocity of palm center.
        
        Args:
            current: Current hand landmarks
            
        Returns:
            Tuple of (vx, vy) velocity in pixels per second
        """
        with self._lock:
            if self._prev_landmarks is None or self._prev_time is None:
                return None
            
            import time
            current_time = time.time()
            dt = current_time - self._prev_time
            
            if dt <= 0:
                return None
            
            dx = current.palm_center[0] - self._prev_landmarks.palm_center[0]
            dy = current.palm_center[1] - self._prev_landmarks.palm_center[1]
            
            vx = dx / dt
            vy = dy / dt
            
            return (vx, vy)
    
    def update_settings(self, min_detection_confidence: float = None,
                       min_tracking_confidence: float = None) -> None:
        """
        Update tracker settings.
        
        Args:
            min_detection_confidence: New detection confidence threshold
            min_tracking_confidence: New tracking confidence threshold
        """
        if min_detection_confidence is not None:
            self.min_detection_confidence = min_detection_confidence
            self.motion_threshold = min_detection_confidence * 50
            
        if min_tracking_confidence is not None:
            self.min_tracking_confidence = min_tracking_confidence
        
        logger.info(f"Hand tracker settings updated: detection={self.min_detection_confidence}, "
                   f"tracking={self.min_tracking_confidence}")
    
    def reset(self) -> None:
        """Reset tracking state."""
        with self._lock:
            self._prev_landmarks = None
            self._prev_time = None
    
    def __del__(self):
        """Cleanup on deletion."""
        # Motion-based tracker doesn't require explicit cleanup
        pass
