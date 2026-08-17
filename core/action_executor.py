"""
Action executor module.
Executes keyboard and mouse actions to control video platforms.
"""

import logging
import pyautogui
import time
from typing import Optional
from enum import Enum

logger = logging.getLogger(__name__)


class Action(Enum):
    """Executable actions."""
    NEXT = "next"
    PREVIOUS = "previous"
    LIKE = "like"


class Platform(Enum):
    """Supported platforms."""
    YOUTUBE = "youtube"
    INSTAGRAM = "instagram"
    TIKTOK = "tiktok"
    GENERIC = "generic"


class ActionExecutor:
    """Executes actions to control video playback."""
    
    # Keyboard shortcuts for different platforms
    SHORTCUTS = {
        Platform.YOUTUBE: {
            Action.NEXT: 'j',  # YouTube Shorts: j for next
            Action.PREVIOUS: 'k',  # YouTube Shorts: k for previous
            Action.LIKE: 'l'  # YouTube Shorts: l for like
        },
        Platform.INSTAGRAM: {
            Action.NEXT: 'down',  # Arrow down
            Action.PREVIOUS: 'up',  # Arrow up
            Action.LIKE: 'l'  # l for like
        },
        Platform.TIKTOK: {
            Action.NEXT: 'down',  # Arrow down
            Action.PREVIOUS: 'up',  # Arrow up
            Action.LIKE: 'l'  # l for like
        },
        Platform.GENERIC: {
            Action.NEXT: 'down',  # Arrow down
            Action.PREVIOUS: 'up',  # Arrow up
            Action.LIKE: 'l'  # l for like
        }
    }
    
    def __init__(self, platform: Platform = Platform.GENERIC):
        """
        Initialize action executor.
        
        Args:
            platform: Target platform for shortcuts
        """
        self.platform = platform
        pyautogui.PAUSE = 0.1  # Small delay between actions
        pyautogui.FAILSAFE = True  # Move mouse to corner to abort
        
        logger.info(f"Action executor initialized for platform: {platform.value}")
    
    def execute(self, action: Action) -> bool:
        """
        Execute an action.
        
        Args:
            action: Action to execute
            
        Returns:
            True if action executed successfully
        """
        try:
            if action == Action.NEXT:
                return self._execute_next()
            elif action == Action.PREVIOUS:
                return self._execute_previous()
            elif action == Action.LIKE:
                return self._execute_like()
            else:
                logger.warning(f"Unknown action: {action}")
                return False
                
        except Exception as e:
            logger.error(f"Error executing action {action}: {e}")
            return False
    
    def _execute_next(self) -> bool:
        """
        Execute next video action.
        
        Returns:
            True if successful
        """
        shortcut = self.SHORTCUTS[self.platform][Action.NEXT]
        
        if shortcut == 'down':
            pyautogui.press('down')
        elif shortcut == 'j':
            pyautogui.press('j')
        else:
            pyautogui.press(shortcut)
        
        logger.info(f"Executed NEXT action ({shortcut})")
        return True
    
    def _execute_previous(self) -> bool:
        """
        Execute previous video action.
        
        Returns:
            True if successful
        """
        shortcut = self.SHORTCUTS[self.platform][Action.PREVIOUS]
        
        if shortcut == 'up':
            pyautogui.press('up')
        elif shortcut == 'k':
            pyautogui.press('k')
        else:
            pyautogui.press(shortcut)
        
        logger.info(f"Executed PREVIOUS action ({shortcut})")
        return True
    
    def _execute_like(self) -> bool:
        """
        Execute like action.
        
        Returns:
            True if successful
        """
        shortcut = self.SHORTCUTS[self.platform][Action.LIKE]
        pyautogui.press(shortcut)
        
        logger.info(f"Executed LIKE action ({shortcut})")
        return True
    
    def set_platform(self, platform: Platform) -> None:
        """
        Change target platform.
        
        Args:
            platform: New platform
        """
        self.platform = platform
        logger.info(f"Platform changed to: {platform.value}")
    
    def get_platform(self) -> Platform:
        """Get current platform."""
        return self.platform
    
    def test_action(self, action: Action) -> str:
        """
        Get the shortcut for an action without executing it.
        
        Args:
            action: Action to query
            
        Returns:
            Shortcut string
        """
        return self.SHORTCUTS[self.platform][action]
