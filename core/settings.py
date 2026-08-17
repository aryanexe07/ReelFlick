"""
Settings management module.
Handles application configuration with automatic persistence.
"""

import json
import logging
import os
from typing import Any, Dict, Optional
from dataclasses import dataclass, asdict, field
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class Settings:
    """Application settings."""
    # Camera settings
    camera_id: int = 0
    camera_width: int = 640
    camera_height: int = 480
    camera_fps: int = 30
    
    # Detection settings
    min_detection_confidence: float = 0.7
    min_tracking_confidence: float = 0.5
    velocity_threshold: float = 500.0
    direction_threshold: float = 0.7
    thumbs_up_duration: float = 0.5
    smoothing_window: int = 5
    
    # Cooldown settings
    cooldown_duration: float = 1.0
    
    # Platform settings
    platform: str = "generic"  # youtube, instagram, tiktok, generic
    scroll_only: bool = True  # Only allow scroll gestures (flick up/down)

    
    # UI settings
    dark_mode: bool = True
    show_landmarks: bool = True
    show_confidence: bool = True
    show_fps: bool = True
    animations_enabled: bool = True
    sound_enabled: bool = False
    
    # Performance settings
    target_fps: int = 60
    max_inference_time_ms: float = 50.0


class SettingsManager:
    """Manages application settings with persistence."""
    
    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize settings manager.
        
        Args:
            config_path: Path to config file (default: config/config.json)
        """
        if config_path is None:
            # Default to config/config.json relative to project root
            project_root = Path(__file__).parent.parent
            config_path = project_root / "config" / "config.json"
        
        self.config_path = Path(config_path)
        self.settings = Settings()
        
        # Ensure config directory exists
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Load settings if file exists
        if self.config_path.exists():
            self.load()
        else:
            self.save()  # Create default config
        
        logger.info(f"Settings manager initialized (config: {self.config_path})")
    
    def load(self) -> bool:
        """
        Load settings from config file.
        
        Returns:
            True if loaded successfully
        """
        try:
            with open(self.config_path, 'r') as f:
                data = json.load(f)
            
            # Update settings with loaded data
            for key, value in data.items():
                if hasattr(self.settings, key):
                    setattr(self.settings, key, value)
            
            logger.info("Settings loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error loading settings: {e}")
            return False
    
    def save(self) -> bool:
        """
        Save settings to config file.
        
        Returns:
            True if saved successfully
        """
        try:
            with open(self.config_path, 'w') as f:
                json.dump(asdict(self.settings), f, indent=4)
            
            logger.info("Settings saved successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error saving settings: {e}")
            return False
    
    def get(self, key: str) -> Any:
        """
        Get a setting value.
        
        Args:
            key: Setting key
            
        Returns:
            Setting value or None if not found
        """
        return getattr(self.settings, key, None)
    
    def set(self, key: str, value: Any, auto_save: bool = True) -> bool:
        """
        Set a setting value.
        
        Args:
            key: Setting key
            value: New value
            auto_save: Whether to save automatically
            
        Returns:
            True if set successfully
        """
        if not hasattr(self.settings, key):
            logger.warning(f"Unknown setting key: {key}")
            return False
        
        setattr(self.settings, key, value)
        
        if auto_save:
            return self.save()
        
        return True
    
    def reset_to_defaults(self) -> bool:
        """
        Reset all settings to defaults.
        
        Returns:
            True if reset successfully
        """
        self.settings = Settings()
        return self.save()
    
    def get_all(self) -> Dict[str, Any]:
        """
        Get all settings as dictionary.
        
        Returns:
            Dictionary of all settings
        """
        return asdict(self.settings)
    
    def update_from_dict(self, data: Dict[str, Any], auto_save: bool = True) -> bool:
        """
        Update settings from dictionary.
        
        Args:
            data: Dictionary of settings
            auto_save: Whether to save automatically
            
        Returns:
            True if updated successfully
        """
        for key, value in data.items():
            if hasattr(self.settings, key):
                setattr(self.settings, key, value)
        
        if auto_save:
            return self.save()
        
        return True
