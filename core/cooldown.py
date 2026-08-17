"""
Cooldown manager for preventing rapid successive actions.
Implements configurable cooldown periods with progress tracking.
"""

import time
import logging
from typing import Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class CooldownState:
    """Current cooldown state."""
    is_active: bool
    remaining_time: float
    total_duration: float
    progress: float  # 0.0 to 1.0


class CooldownManager:
    """Manages action cooldowns to prevent accidental triggers."""
    
    def __init__(self, default_duration: float = 1.0):
        """
        Initialize cooldown manager.
        
        Args:
            default_duration: Default cooldown duration in seconds
        """
        self.default_duration = default_duration
        self._cooldown_duration = default_duration
        self._cooldown_start: Optional[float] = None
        self._is_active = False
        
        logger.info(f"Cooldown manager initialized (duration: {default_duration}s)")
    
    def start_cooldown(self, duration: Optional[float] = None) -> None:
        """
        Start cooldown period.
        
        Args:
            duration: Custom cooldown duration (uses default if None)
        """
        if duration is None:
            duration = self._cooldown_duration
        
        self._cooldown_duration = duration
        self._cooldown_start = time.time()
        self._is_active = True
        
        logger.debug(f"Cooldown started ({duration}s)")
    
    def get_state(self) -> CooldownState:
        """
        Get current cooldown state.
        
        Returns:
            CooldownState with current status
        """
        if not self._is_active or self._cooldown_start is None:
            return CooldownState(False, 0.0, self._cooldown_duration, 1.0)
        
        elapsed = time.time() - self._cooldown_start
        remaining = max(0.0, self._cooldown_duration - elapsed)
        progress = 1.0 - (remaining / self._cooldown_duration) if self._cooldown_duration > 0 else 1.0
        
        if remaining <= 0:
            self._is_active = False
            self._cooldown_start = None
            return CooldownState(False, 0.0, self._cooldown_duration, 1.0)
        
        return CooldownState(True, remaining, self._cooldown_duration, progress)
    
    def is_ready(self) -> bool:
        """
        Check if cooldown has expired.
        
        Returns:
            True if ready for next action
        """
        state = self.get_state()
        return not state.is_active
    
    def reset(self) -> None:
        """Reset cooldown state."""
        self._is_active = False
        self._cooldown_start = None
        logger.debug("Cooldown reset")
    
    def set_duration(self, duration: float) -> None:
        """
        Set default cooldown duration.
        
        Args:
            duration: New cooldown duration in seconds
        """
        self.default_duration = duration
        self._cooldown_duration = duration
        logger.info(f"Cooldown duration set to {duration}s")
    
    def get_duration(self) -> float:
        """Get current cooldown duration."""
        return self._cooldown_duration
