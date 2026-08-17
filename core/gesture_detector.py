"""
Gesture detection module.
Detects flick up/down movements and thumbs-up gestures with high precision.
"""

import logging
import time
from typing import Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from collections import deque
import numpy as np

from core.hand_tracker import HandLandmarks

logger = logging.getLogger(__name__)


class Gesture(Enum):
    """Detected gesture types."""
    NONE = "none"
    FLICK_UP = "flick_up"
    FLICK_DOWN = "flick_down"
    THUMBS_UP = "thumbs_up"


@dataclass
class GestureResult:
    """Result of gesture detection."""
    gesture: Gesture
    confidence: float
    velocity: Tuple[float, float]
    message: str


class GestureDetector:
    """Detects hand gestures with precision and debouncing."""
    
    def __init__(self, 
                 velocity_threshold: float = 500.0,
                 direction_threshold: float = 0.7,
                 thumbs_up_duration: float = 0.5,
                 smoothing_window: int = 5,
                 scroll_only: bool = False):
        """
        Initialize gesture detector.
        
        Args:
            velocity_threshold: Minimum velocity for flick detection (pixels/sec)
            direction_threshold: Minimum direction confidence (0-1)
            thumbs_up_duration: Duration to hold thumbs up (seconds)
            smoothing_window: Number of frames for velocity smoothing
            scroll_only: If True, only detect scroll flick gestures
        """
        self.velocity_threshold = velocity_threshold
        self.direction_threshold = direction_threshold
        self.thumbs_up_duration = thumbs_up_duration
        self.smoothing_window = smoothing_window
        self.scroll_only = scroll_only
        
        # Velocity smoothing
        self._velocity_history: deque = deque(maxlen=smoothing_window)
        
        # Thumbs up tracking
        self._thumbs_up_start_time: Optional[float] = None
        self._thumbs_up_confirmed = False
        
        # Flick detection state
        self._flick_in_progress = False
        self._flick_start_time: Optional[float] = None
        self._flick_direction: Optional[str] = None
        
        # Debounce
        self._last_gesture_time: Optional[float] = None
        self._debounce_delay = 0.1  # Minimum time between gestures
        
        logger.info("Gesture detector initialized")
    
    def detect(self, landmarks: HandLandmarks, 
               velocity: Optional[Tuple[float, float]]) -> GestureResult:
        """
        Detect gesture from landmarks and velocity.
        
        Args:
            landmarks: Current hand landmarks
            velocity: Current palm velocity (vx, vy)
            
        Returns:
            GestureResult with detected gesture and confidence
        """
        if landmarks is None or velocity is None:
            self._reset_state()
            return GestureResult(Gesture.NONE, 0.0, (0.0, 0.0), "No hand detected")
        
        # Smooth velocity
        smoothed_velocity = self._smooth_velocity(velocity)
        vx, vy = smoothed_velocity
        
        # Check for debounce
        current_time = time.time()
        if (self._last_gesture_time and 
            current_time - self._last_gesture_time < self._debounce_delay):
            return GestureResult(Gesture.NONE, 0.0, smoothed_velocity, "Debounce active")
        
        # Detect gestures in priority order
        result = self._detect_flick(landmarks, smoothed_velocity, current_time)
        
        if result.gesture == Gesture.NONE and not self.scroll_only:
            result = self._detect_thumbs_up(landmarks, current_time)
        
        # Update last gesture time if gesture detected
        if result.gesture != Gesture.NONE:
            self._last_gesture_time = current_time
            logger.info(f"Gesture detected: {result.gesture.value} (confidence: {result.confidence:.2f})")
        
        return result
    
    def _smooth_velocity(self, velocity: Tuple[float, float]) -> Tuple[float, float]:
        """
        Smooth velocity using moving average.
        
        Args:
            velocity: Current velocity
            
        Returns:
            Smoothed velocity
        """
        self._velocity_history.append(velocity)
        
        if len(self._velocity_history) < 2:
            return velocity
        
        # Calculate average
        avg_vx = sum(v[0] for v in self._velocity_history) / len(self._velocity_history)
        avg_vy = sum(v[1] for v in self._velocity_history) / len(self._velocity_history)
        
        return (avg_vx, avg_vy)
    
    def _detect_flick(self, landmarks: HandLandmarks, 
                     velocity: Tuple[float, float],
                     current_time: float) -> GestureResult:
        """
        Detect flick gestures (up/down).
        
        Args:
            landmarks: Hand landmarks
            velocity: Smoothed velocity
            current_time: Current timestamp
            
        Returns:
            GestureResult
        """
        vx, vy = velocity
        speed = np.sqrt(vx**2 + vy**2)
        
        # Reset thumbs up if moving
        if speed > 100:
            self._thumbs_up_start_time = None
            self._thumbs_up_confirmed = False
        
        # Check if velocity is above threshold
        if speed < self.velocity_threshold:
            self._flick_in_progress = False
            self._flick_start_time = None
            self._flick_direction = None
            return GestureResult(Gesture.NONE, 0.0, velocity, "Below velocity threshold")
        
        # Calculate direction
        if abs(vy) > abs(vx):
            # Vertical movement
            direction = "up" if vy < 0 else "down"
            direction_confidence = abs(vy) / speed
        else:
            # Horizontal movement - ignore
            return GestureResult(Gesture.NONE, 0.0, velocity, "Horizontal movement")
        
        # Check direction confidence
        if direction_confidence < self.direction_threshold:
            return GestureResult(Gesture.NONE, 0.0, velocity, "Low direction confidence")
        
        # Start or continue flick detection
        if not self._flick_in_progress:
            self._flick_in_progress = True
            self._flick_start_time = current_time
            self._flick_direction = direction
            return GestureResult(Gesture.NONE, 0.0, velocity, "Flick started")
        
        # Check if flick has stopped (velocity dropped significantly)
        if self._flick_in_progress and speed < self.velocity_threshold * 0.5:
            # Flick completed
            flick_duration = current_time - self._flick_start_time
            
            # Flick must be quick (0.1-0.5 seconds)
            if 0.1 <= flick_duration <= 0.5:
                gesture = Gesture.FLICK_UP if self._flick_direction == "up" else Gesture.FLICK_DOWN
                confidence = min(1.0, speed / (self.velocity_threshold * 2))
                
                # Reset state
                self._flick_in_progress = False
                self._flick_start_time = None
                self._flick_direction = None
                
                return GestureResult(
                    gesture, 
                    confidence, 
                    velocity, 
                    f"{gesture.value} detected"
                )
            else:
                # Flick too slow or too fast
                self._flick_in_progress = False
                self._flick_start_time = None
                self._flick_direction = None
                return GestureResult(Gesture.NONE, 0.0, velocity, "Invalid flick duration")
        
        # Flick still in progress
        return GestureResult(Gesture.NONE, 0.0, velocity, "Flick in progress")
    
    def _detect_thumbs_up(self, landmarks: HandLandmarks,
                         current_time: float) -> GestureResult:
        """
        Detect thumbs-up gesture.
        
        Args:
            landmarks: Hand landmarks
            current_time: Current timestamp
            
        Returns:
            GestureResult
        """
        # Check thumbs up conditions
        is_thumbs_up = self._is_thumbs_up_pose(landmarks)
        
        if not is_thumbs_up:
            self._thumbs_up_start_time = None
            self._thumbs_up_confirmed = False
            return GestureResult(Gesture.NONE, 0.0, (0.0, 0.0), "Not thumbs up pose")
        
        # Start or continue tracking
        if self._thumbs_up_start_time is None:
            self._thumbs_up_start_time = current_time
            return GestureResult(Gesture.NONE, 0.0, (0.0, 0.0), "Thumbs up started")
        
        # Check if held long enough
        duration = current_time - self._thumbs_up_start_time
        
        if duration >= self.thumbs_up_duration and not self._thumbs_up_confirmed:
            self._thumbs_up_confirmed = True
            confidence = min(1.0, duration / self.thumbs_up_duration)
            
            # Reset after confirmation
            self._thumbs_up_start_time = None
            self._thumbs_up_confirmed = False
            
            return GestureResult(
                Gesture.THUMBS_UP,
                confidence,
                (0.0, 0.0),
                f"Thumbs up held for {duration:.2f}s"
            )
        
        return GestureResult(Gesture.NONE, 0.0, (0.0, 0.0), f"Thumbs up held: {duration:.2f}s")
    
    def _is_thumbs_up_pose(self, landmarks: HandLandmarks) -> bool:
        """
        Check if hand is in thumbs-up pose.
        
        Args:
            landmarks: Hand landmarks
            
        Returns:
            True if thumbs-up pose detected
        """
        # Conditions:
        # 1. Thumb is extended (tip above IP joint)
        # 2. Other fingers are folded (tips below MCP joints)
        # 3. Hand is upright (wrist below finger MCPs)
        
        try:
            # Thumb extended: thumb tip y < thumb IP y (y increases downward)
            thumb_extended = landmarks.thumb_tip[1] < landmarks.index_mcp[1]
            
            # Index folded: index tip y > index MCP y
            index_folded = landmarks.index_tip[1] > landmarks.index_mcp[1]
            
            # Middle folded: middle tip y > middle MCP y
            middle_folded = landmarks.index_tip[1] > landmarks.middle_mcp[1]
            
            # Ring folded: ring tip y > ring MCP y
            ring_folded = landmarks.index_tip[1] > landmarks.ring_mcp[1]
            
            # Pinky folded: pinky tip y > pinky MCP y
            pinky_folded = landmarks.index_tip[1] > landmarks.pinky_mcp[1]
            
            # Hand upright: wrist y > palm center y
            hand_upright = landmarks.wrist[1] > landmarks.palm_center[1]
            
            # All conditions must be true
            return (thumb_extended and index_folded and middle_folded and 
                   ring_folded and pinky_folded and hand_upright)
            
        except Exception as e:
            logger.error(f"Error checking thumbs up pose: {e}")
            return False
    
    def _reset_state(self) -> None:
        """Reset all tracking state."""
        self._thumbs_up_start_time = None
        self._thumbs_up_confirmed = False
        self._flick_in_progress = False
        self._flick_start_time = None
        self._flick_direction = None
        self._velocity_history.clear()
    
    def update_settings(self, velocity_threshold: float = None,
                       direction_threshold: float = None,
                       thumbs_up_duration: float = None) -> None:
        """
        Update detector settings.
        
        Args:
            velocity_threshold: New velocity threshold
            direction_threshold: New direction threshold
            thumbs_up_duration: New thumbs up duration
        """
        if velocity_threshold is not None:
            self.velocity_threshold = velocity_threshold
        if direction_threshold is not None:
            self.direction_threshold = direction_threshold
        if thumbs_up_duration is not None:
            self.thumbs_up_duration = thumbs_up_duration
        
        logger.info(f"Gesture detector settings updated")
    
    def reset(self) -> None:
        """Reset detector state."""
        self._reset_state()
