"""
Main application window.
Integrates all components and manages the application lifecycle.
"""

import sys
import logging
import time
from typing import Optional
from PySide6.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
                                QSplitter, QFrame, QMessageBox, QDialog,
                                QDialogButtonBox, QLabel, QComboBox, QSpinBox)
from PySide6.QtCore import Qt, QTimer, Signal
from PySide6.QtGui import QCloseEvent

from core.camera import Camera
from core.hand_tracker import HandTracker
from core.gesture_detector import GestureDetector, Gesture
from core.cooldown import CooldownManager
from core.action_executor import ActionExecutor, Action, Platform
from core.settings import SettingsManager
from ui.theme import Theme
from ui.widgets import (CameraWidget, StatusWidget, ControlPanel, 
                        SettingsPanel, CooldownIndicator)

logger = logging.getLogger(__name__)


class CalibrationDialog(QDialog):
    """Calibration wizard dialog."""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Calibration")
        self.setMinimumSize(400, 300)
        self.setup_ui()
    
    def setup_ui(self):
        """Setup calibration dialog UI."""
        layout = QVBoxLayout(self)
        
        # Instructions
        instructions = QLabel(
            "Calibration Wizard\n\n"
            "1. Position your hand 30-50cm from the camera\n"
            "2. Ensure good lighting\n"
            "3. Keep your hand in the frame\n"
            "4. Test each gesture\n\n"
            "Click Start when ready."
        )
        instructions.setWordWrap(True)
        instructions.setStyleSheet(f"color: {Theme.TEXT_PRIMARY.name()};")
        layout.addWidget(instructions)
        
        # Buttons
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)


class SettingsDialog(QDialog):
    """Settings dialog for advanced configuration."""
    
    def __init__(self, settings_manager: SettingsManager, parent=None):
        super().__init__(parent)
        self.settings_manager = settings_manager
        self.setWindowTitle("Advanced Settings")
        self.setMinimumSize(500, 400)
        self.setup_ui()
        self.load_settings()
    
    def setup_ui(self):
        """Setup settings dialog UI."""
        layout = QVBoxLayout(self)
        
        # Camera settings
        camera_frame = QFrame()
        camera_layout = QVBoxLayout(camera_frame)
        camera_layout.addWidget(QLabel("Camera ID"))
        self.camera_combo = QComboBox()
        camera_layout.addWidget(self.camera_combo)
        layout.addWidget(camera_frame)
        
        # Detection settings
        detection_frame = QFrame()
        detection_layout = QVBoxLayout(detection_frame)
        detection_layout.addWidget(QLabel("Velocity Threshold"))
        self.velocity_spin = QSpinBox()
        self.velocity_spin.setRange(100, 2000)
        self.velocity_spin.setSuffix(" px/s")
        detection_layout.addWidget(self.velocity_spin)
        
        detection_layout.addWidget(QLabel("Thumbs Up Duration"))
        self.duration_spin = QSpinBox()
        self.duration_spin.setRange(1, 20)
        self.duration_spin.setSuffix(" s")
        self.duration_spin.setValue(5)
        detection_layout.addWidget(self.duration_spin)
        layout.addWidget(detection_frame)
        
        # Buttons
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Save | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self.save_settings)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)
    
    def load_settings(self):
        """Load settings into dialog."""
        self.camera_combo.clear()
        available_cameras = Camera.list_available_cameras()
        self.camera_combo.addItems([str(cam) for cam in available_cameras])
        
        self.velocity_spin.setValue(int(self.settings_manager.get('velocity_threshold')))
        self.duration_spin.setValue(int(self.settings_manager.get('thumbs_up_duration') * 10))
    
    def save_settings(self):
        """Save settings from dialog."""
        self.settings_manager.set('camera_id', int(self.camera_combo.currentText()))
        self.settings_manager.set('velocity_threshold', self.velocity_spin.value())
        self.settings_manager.set('thumbs_up_duration', self.duration_spin.value() / 10.0)
        self.accept()


class MainWindow(QMainWindow):
    """Main application window."""
    
    def __init__(self):
        super().__init__()
        self.settings_manager = SettingsManager()
        
        # Initialize components
        self.camera = Camera(self.settings_manager.get('camera_id'))
        self.hand_tracker = HandTracker(
            min_detection_confidence=self.settings_manager.get('min_detection_confidence'),
            min_tracking_confidence=self.settings_manager.get('min_tracking_confidence')
        )
        self.gesture_detector = GestureDetector(
            velocity_threshold=self.settings_manager.get('velocity_threshold'),
            direction_threshold=self.settings_manager.get('direction_threshold'),
            thumbs_up_duration=self.settings_manager.get('thumbs_up_duration')
        )
        self.cooldown_manager = CooldownManager(
            default_duration=self.settings_manager.get('cooldown_duration')
        )
        self.action_executor = ActionExecutor(
            platform=Platform(self.settings_manager.get('platform'))
        )
        
        # State
        self.is_running = False
        self.last_action = "None"
        self.inference_time = 0.0
        
        # Setup UI
        self.setup_ui()
        self.apply_theme()
        
        # Timers
        self.process_timer = QTimer()
        self.process_timer.timeout.connect(self.process_frame)
        
        self.ui_update_timer = QTimer()
        self.ui_update_timer.timeout.connect(self.update_ui)
        self.ui_update_timer.start(100)  # Update UI at 10 FPS
        
        logger.info("Main window initialized")
    
    def setup_ui(self):
        """Setup main window UI."""
        self.setWindowTitle("Air Gesture Shorts Controller")
        self.setMinimumSize(1200, 800)
        
        # Central widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Main layout
        main_layout = QHBoxLayout(central_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)
        
        # Splitter for resizable panels
        splitter = QSplitter(Qt.Horizontal)
        main_layout.addWidget(splitter)
        
        # Left panel (camera and controls)
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        left_layout.setContentsMargins(Theme.SPACING_LG, Theme.SPACING_LG, 
                                      Theme.SPACING_LG, Theme.SPACING_LG)
        left_layout.setSpacing(Theme.SPACING_LG)
        
        # Title
        title = QLabel("Air Gesture Shorts Controller")
        title.setFont(Theme.get_font(Theme.FONT_SIZE_XXL, bold=True))
        title.setStyleSheet(f"color: {Theme.TEXT_PRIMARY.name()};")
        left_layout.addWidget(title)
        
        # Status bar
        self.status_widget = StatusWidget()
        left_layout.addWidget(self.status_widget)
        
        # Camera widget
        self.camera_widget = CameraWidget()
        left_layout.addWidget(self.camera_widget, 1)
        
        # Control panel
        self.control_panel = ControlPanel()
        self.control_panel.start_clicked.connect(self.start_camera)
        self.control_panel.stop_clicked.connect(self.stop_camera)
        self.control_panel.calibration_clicked.connect(self.show_calibration)
        self.control_panel.settings_clicked.connect(self.show_settings)
        self.control_panel.exit_clicked.connect(self.close)
        left_layout.addWidget(self.control_panel)
        
        splitter.addWidget(left_panel)
        
        # Right panel (settings and statistics)
        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)
        right_layout.setContentsMargins(Theme.SPACING_LG, Theme.SPACING_LG, 
                                       Theme.SPACING_LG, Theme.SPACING_LG)
        right_layout.setSpacing(Theme.SPACING_LG)
        
        # Settings panel
        self.settings_panel = SettingsPanel()
        self.settings_panel.sensitivity_changed.connect(self.on_sensitivity_changed)
        self.settings_panel.cooldown_changed.connect(self.on_cooldown_changed)
        self.settings_panel.confidence_changed.connect(self.on_confidence_changed)
        self.settings_panel.platform_changed.connect(self.on_platform_changed)
        right_layout.addWidget(self.settings_panel)
        
        # Cooldown indicator
        cooldown_layout = QHBoxLayout()
        cooldown_layout.addWidget(QLabel("Cooldown Status"))
        cooldown_layout.addStretch()
        self.cooldown_indicator = CooldownIndicator()
        cooldown_layout.addWidget(self.cooldown_indicator)
        right_layout.addLayout(cooldown_layout)
        
        right_layout.addStretch()
        
        splitter.addWidget(right_panel)
        
        # Set splitter proportions
        splitter.setStretchFactor(0, 3)
        splitter.setStretchFactor(1, 1)
        
        # Initialize settings panel values
        self.settings_panel.set_sensitivity(
            self.settings_manager.get('velocity_threshold') / 1000.0
        )
        self.settings_panel.set_cooldown(
            self.settings_manager.get('cooldown_duration')
        )
        self.settings_panel.set_confidence(
            self.settings_manager.get('min_detection_confidence')
        )
        self.settings_panel.set_platform(
            self.settings_manager.get('platform').capitalize()
        )
    
    def apply_theme(self):
        """Apply dark mode theme."""
        self.setStyleSheet(Theme.get_stylesheet())
        self.setPalette(Theme.get_palette())
    
    def start_camera(self):
        """Start camera and begin processing."""
        if self.camera.start():
            self.is_running = True
            self.control_panel.set_camera_running(True)
            self.status_widget.update_camera_status(True)
            self.process_timer.start(16)  # ~60 FPS
            logger.info("Camera started")
        else:
            QMessageBox.warning(self, "Error", "Failed to start camera")
    
    def stop_camera(self):
        """Stop camera and processing."""
        self.is_running = False
        self.process_timer.stop()
        self.camera.stop()
        self.hand_tracker.reset()
        self.gesture_detector.reset()
        self.control_panel.set_camera_running(False)
        self.status_widget.update_camera_status(False)
        self.camera_widget.set_frame(None)
        logger.info("Camera stopped")
    
    def process_frame(self):
        """Process camera frame for gesture detection."""
        if not self.is_running:
            return
        
        # Read frame
        result = self.camera.read_frame()
        if result is None:
            return
        
        success, frame = result
        if not success or frame is None:
            return
        
        # Track inference time
        start_time = time.time()
        
        # Process hand tracking
        landmarks, annotated_frame = self.hand_tracker.process_frame(frame)
        
        # Calculate velocity if landmarks detected
        velocity = None
        if landmarks:
            velocity = self.hand_tracker.calculate_velocity(landmarks)
        
        # Detect gestures
        gesture_result = self.gesture_detector.detect(landmarks, velocity)
        
        # Update inference time
        self.inference_time = (time.time() - start_time) * 1000
        
        # Handle gesture
        if gesture_result.gesture != Gesture.NONE:
            if self.cooldown_manager.is_ready():
                self.execute_action(gesture_result.gesture)
                self.cooldown_manager.start_cooldown()
                
                # Trigger animation
                if gesture_result.gesture == Gesture.FLICK_UP:
                    self.camera_widget.trigger_animation('up')
                elif gesture_result.gesture == Gesture.FLICK_DOWN:
                    self.camera_widget.trigger_animation('down')
                elif gesture_result.gesture == Gesture.THUMBS_UP:
                    self.camera_widget.trigger_animation('like')
        
        # Update camera widget
        self.camera_widget.set_frame(annotated_frame)
        self.camera_widget.set_gesture_info(
            gesture_result.gesture.value if gesture_result.gesture != Gesture.NONE else "None",
            gesture_result.confidence
        )
        
        # Update status
        self.status_widget.update_gesture_status(gesture_result.gesture.value)
    
    def execute_action(self, gesture: Gesture):
        """Execute action based on gesture."""
        action = None
        
        if gesture == Gesture.FLICK_UP:
            action = Action.NEXT
            self.last_action = "Next"
        elif gesture == Gesture.FLICK_DOWN:
            action = Action.PREVIOUS
            self.last_action = "Previous"
        elif gesture == Gesture.THUMBS_UP:
            action = Action.LIKE
            self.last_action = "Like"
        
        if action:
            self.action_executor.execute(action)
            logger.info(f"Executed action: {action.value}")
    
    def update_ui(self):
        """Update UI elements."""
        # Update FPS
        if self.is_running:
            fps = self.camera.get_fps()
            self.status_widget.update_fps(fps)
            
            # Update statistics
            self.settings_panel.update_statistics(
                self.camera_widget.gesture_name,
                self.last_action,
                fps,
                self.inference_time
            )
        
        # Update cooldown indicator
        cooldown_state = self.cooldown_manager.get_state()
        self.cooldown_indicator.set_progress(
            cooldown_state.progress,
            cooldown_state.is_active
        )
    
    def on_sensitivity_changed(self, value: float):
        """Handle sensitivity slider change."""
        velocity_threshold = value * 1000.0
        self.gesture_detector.update_settings(velocity_threshold=velocity_threshold)
        self.settings_manager.set('velocity_threshold', velocity_threshold)
    
    def on_cooldown_changed(self, value: float):
        """Handle cooldown slider change."""
        self.cooldown_manager.set_duration(value)
        self.settings_manager.set('cooldown_duration', value)
    
    def on_confidence_changed(self, value: float):
        """Handle confidence slider change."""
        self.hand_tracker.update_settings(min_detection_confidence=value)
        self.settings_manager.set('min_detection_confidence', value)
    
    def on_platform_changed(self, platform: str):
        """Handle platform combo change."""
        platform_lower = platform.lower()
        try:
            self.action_executor.set_platform(Platform(platform_lower))
            self.settings_manager.set('platform', platform_lower)
        except ValueError:
            logger.warning(f"Invalid platform: {platform}")
    
    def show_calibration(self):
        """Show calibration dialog."""
        dialog = CalibrationDialog(self)
        if dialog.exec():
            QMessageBox.information(self, "Calibration", 
                                   "Calibration complete!\n\n"
                                   "Your settings have been optimized.")
    
    def show_settings(self):
        """Show settings dialog."""
        dialog = SettingsDialog(self.settings_manager, self)
        if dialog.exec():
            # Reload camera if ID changed
            new_camera_id = self.settings_manager.get('camera_id')
            if new_camera_id != self.camera.camera_id:
                was_running = self.is_running
                if was_running:
                    self.stop_camera()
                self.camera.set_camera_id(new_camera_id)
                if was_running:
                    self.start_camera()
            
            # Update gesture detector settings
            self.gesture_detector.update_settings(
                velocity_threshold=self.settings_manager.get('velocity_threshold'),
                thumbs_up_duration=self.settings_manager.get('thumbs_up_duration')
            )
    
    def closeEvent(self, event: QCloseEvent):
        """Handle window close event."""
        if self.is_running:
            self.stop_camera()
        
        # Save settings
        self.settings_manager.save()
        
        logger.info("Application closing")
        event.accept()
