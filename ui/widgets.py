"""
Custom UI widgets for the application.
Provides specialized components for camera preview, status display, and controls.
"""

from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                                QPushButton, QSlider, QFrame, QComboBox,
                                QGridLayout, QProgressBar)
from PySide6.QtCore import Qt, QTimer, Signal, QRectF
from PySide6.QtGui import QPainter, QColor, QPen, QBrush, QFont, QPixmap, QImage
import cv2
import numpy as np

from ui.theme import Theme


class CameraWidget(QWidget):
    """Widget for displaying camera feed with overlays."""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setMinimumSize(640, 480)
        self.current_frame = None
        self.gesture_name = ""
        self.confidence = 0.0
        self.show_landmarks = True
        self.show_confidence = True
        
        # Animation state
        self.animation_active = False
        self.animation_type = None  # 'up', 'down', 'like'
        self.animation_progress = 0.0
        self.animation_timer = QTimer()
        self.animation_timer.timeout.connect(self._update_animation)
        
    def set_frame(self, frame):
        """Set current camera frame."""
        self.current_frame = frame
        self.update()
    
    def set_gesture_info(self, gesture_name: str, confidence: float):
        """Set gesture information for overlay."""
        self.gesture_name = gesture_name
        self.confidence = confidence
        self.update()
    
    def trigger_animation(self, animation_type: str):
        """Trigger visual feedback animation."""
        self.animation_type = animation_type
        self.animation_active = True
        self.animation_progress = 0.0
        self.animation_timer.start(16)  # ~60 FPS
    
    def _update_animation(self):
        """Update animation progress."""
        self.animation_progress += 0.05
        if self.animation_progress >= 1.0:
            self.animation_active = False
            self.animation_timer.stop()
        self.update()
    
    def paintEvent(self, event):
        """Paint the camera feed and overlays."""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        # Draw background
        painter.fillRect(self.rect(), Theme.BACKGROUND)
        
        # Draw camera frame
        if self.current_frame is not None:
            self._draw_frame(painter)
        else:
            self._draw_placeholder(painter)
        
        # Draw gesture overlay
        if self.gesture_name:
            self._draw_gesture_overlay(painter)
        
        # Draw animation
        if self.animation_active:
            self._draw_animation(painter)
    
    def _draw_frame(self, painter: QPainter):
        """Draw the camera frame."""
        # Convert BGR to RGB
        rgb_frame = cv2.cvtColor(self.current_frame, cv2.COLOR_BGR2RGB)
        
        # Create QImage
        h, w, ch = rgb_frame.shape
        bytes_per_line = ch * w
        qimage = QImage(rgb_frame.data, w, h, bytes_per_line, QImage.Format_RGB888)
        
        # Scale to fit widget while maintaining aspect ratio
        pixmap = QPixmap.fromImage(qimage)
        scaled_pixmap = pixmap.scaled(
            self.size(), 
            Qt.KeepAspectRatio, 
            Qt.SmoothTransformation
        )
        
        # Center the pixmap
        x = (self.width() - scaled_pixmap.width()) // 2
        y = (self.height() - scaled_pixmap.height()) // 2
        painter.drawPixmap(x, y, scaled_pixmap)
    
    def _draw_placeholder(self, painter: QPainter):
        """Draw placeholder when no camera feed."""
        painter.setPen(Theme.TEXT_DISABLED)
        painter.setFont(Theme.get_font(Theme.FONT_SIZE_LG))
        painter.drawText(self.rect(), Qt.AlignCenter, "Camera Off")
    
    def _draw_gesture_overlay(self, painter: QPainter):
        """Draw gesture information overlay."""
        # Background box
        overlay_rect = QRectF(20, 20, 200, 80)
        painter.setBrush(QColor(0, 0, 0, 180))
        painter.setPen(Qt.NoPen)
        painter.drawRoundedRect(overlay_rect, 8, 8)
        
        # Gesture name
        painter.setPen(Theme.TEXT_PRIMARY)
        painter.setFont(Theme.get_font(Theme.FONT_SIZE_LG, bold=True))
        painter.drawText(overlay_rect.adjusted(10, 10, -10, -10), Qt.AlignLeft | Qt.AlignTop, 
                         f"Gesture: {self.gesture_name}")
        
        # Confidence
        if self.show_confidence:
            painter.setPen(Theme.TEXT_SECONDARY)
            painter.setFont(Theme.get_font(Theme.FONT_SIZE_SM))
            confidence_text = f"Confidence: {self.confidence:.0%}"
            painter.drawText(overlay_rect.adjusted(10, 10, -10, -10), 
                           Qt.AlignLeft | Qt.AlignBottom, confidence_text)
    
    def _draw_animation(self, painter: QPainter):
        """Draw gesture feedback animation."""
        center_x = self.width() // 2
        center_y = self.height() // 2
        
        if self.animation_type == 'up':
            # Green upward arrow
            painter.setBrush(Theme.ACCENT_GREEN)
            painter.setPen(Qt.NoPen)
            
            # Draw arrow pointing up
            size = 100 * self.animation_progress
            arrow_points = [
                (center_x, center_y - size),
                (center_x - size/2, center_y),
                (center_x + size/2, center_y)
            ]
            from PySide6.QtGui import QPolygonF
            from PySide6.QtCore import QPointF
            polygon = QPolygonF([QPointF(*p) for p in arrow_points])
            painter.drawPolygon(polygon)
            
        elif self.animation_type == 'down':
            # Blue downward arrow
            painter.setBrush(Theme.ACCENT_BLUE)
            painter.setPen(Qt.NoPen)
            
            size = 100 * self.animation_progress
            arrow_points = [
                (center_x, center_y + size),
                (center_x - size/2, center_y),
                (center_x + size/2, center_y)
            ]
            from PySide6.QtGui import QPolygonF
            from PySide6.QtCore import QPointF
            polygon = QPolygonF([QPointF(*p) for p in arrow_points])
            painter.drawPolygon(polygon)
            
        elif self.animation_type == 'like':
            # Red heart
            painter.setBrush(Theme.ACCENT_RED)
            painter.setPen(Qt.NoPen)
            
            size = 80 * self.animation_progress
            
            # Draw heart shape
            from PySide6.QtGui import QPainterPath
            path = QPainterPath()
            path.moveTo(center_x, center_y + size/4)
            path.cubicTo(center_x - size/2, center_y - size/2, 
                        center_x - size, center_y + size/4, 
                        center_x, center_y + size)
            path.cubicTo(center_x + size, center_y + size/4, 
                        center_x + size/2, center_y - size/2, 
                        center_x, center_y + size/4)
            painter.drawPath(path)


class StatusWidget(QFrame):
    """Widget for displaying application status."""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setup_ui()
    
    def setup_ui(self):
        """Setup status widget UI."""
        layout = QHBoxLayout(self)
        layout.setContentsMargins(Theme.SPACING_MD, Theme.SPACING_SM, 
                                 Theme.SPACING_MD, Theme.SPACING_SM)
        
        # Status labels
        self.camera_status = StatusLabel("Camera: Disconnected", Theme.TEXT_DISABLED)
        self.fps_label = StatusLabel("FPS: --", Theme.TEXT_SECONDARY)
        self.gesture_status = StatusLabel("Gesture: None", Theme.TEXT_SECONDARY)
        
        layout.addWidget(self.camera_status)
        layout.addStretch()
        layout.addWidget(self.fps_label)
        layout.addWidget(self.gesture_status)
    
    def update_camera_status(self, connected: bool):
        """Update camera connection status."""
        if connected:
            self.camera_status.setText("Camera: Connected")
            self.camera_status.setColor(Theme.ACCENT_GREEN)
        else:
            self.camera_status.setText("Camera: Disconnected")
            self.camera_status.setColor(Theme.TEXT_DISABLED)
    
    def update_fps(self, fps: float):
        """Update FPS display."""
        self.fps_label.setText(f"FPS: {fps:.1f}")
    
    def update_gesture_status(self, gesture: str):
        """Update gesture status."""
        self.gesture_status.setText(f"Gesture: {gesture}")


class StatusLabel(QLabel):
    """Custom label for status display."""
    
    def __init__(self, text: str, color: QColor, parent=None):
        super().__init__(text, parent)
        self.color = color
        self.setFont(Theme.get_font(Theme.FONT_SIZE_SM))
        self.setStyleSheet(f"color: {color.name()};")
    
    def setColor(self, color: QColor):
        """Set label color."""
        self.color = color
        self.setStyleSheet(f"color: {color.name()};")


class ControlPanel(QFrame):
    """Panel for application controls."""
    
    start_clicked = Signal()
    stop_clicked = Signal()
    calibration_clicked = Signal()
    settings_clicked = Signal()
    exit_clicked = Signal()
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setup_ui()
    
    def setup_ui(self):
        """Setup control panel UI."""
        layout = QHBoxLayout(self)
        layout.setContentsMargins(Theme.SPACING_MD, Theme.SPACING_SM, 
                                 Theme.SPACING_MD, Theme.SPACING_SM)
        layout.setSpacing(Theme.SPACING_MD)
        
        # Create buttons
        self.start_button = QPushButton("Start Camera")
        self.stop_button = QPushButton("Stop Camera")
        self.stop_button.setEnabled(False)
        self.calibration_button = QPushButton("Calibration")
        self.settings_button = QPushButton("Settings")
        self.exit_button = QPushButton("Exit")
        
        # Connect signals
        self.start_button.clicked.connect(self.start_clicked.emit)
        self.stop_button.clicked.connect(self.stop_clicked.emit)
        self.calibration_button.clicked.connect(self.calibration_clicked.emit)
        self.settings_button.clicked.connect(self.settings_clicked.emit)
        self.exit_button.clicked.connect(self.exit_clicked.emit)
        
        # Add to layout
        layout.addWidget(self.start_button)
        layout.addWidget(self.stop_button)
        layout.addWidget(self.calibration_button)
        layout.addWidget(self.settings_button)
        layout.addStretch()
        layout.addWidget(self.exit_button)
    
    def set_camera_running(self, running: bool):
        """Update button states based on camera status."""
        self.start_button.setEnabled(not running)
        self.stop_button.setEnabled(running)


class SettingsPanel(QFrame):
    """Side panel for settings and statistics."""
    
    sensitivity_changed = Signal(float)
    cooldown_changed = Signal(float)
    confidence_changed = Signal(float)
    platform_changed = Signal(str)
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setup_ui()
    
    def setup_ui(self):
        """Setup settings panel UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(Theme.SPACING_MD, Theme.SPACING_MD, 
                                 Theme.SPACING_MD, Theme.SPACING_MD)
        layout.setSpacing(Theme.SPACING_LG)
        
        # Title
        title = QLabel("Settings")
        title.setFont(Theme.get_font(Theme.FONT_SIZE_XL, bold=True))
        layout.addWidget(title)
        
        # Sensitivity slider
        layout.addWidget(QLabel("Sensitivity"))
        self.sensitivity_slider = QSlider(Qt.Horizontal)
        self.sensitivity_slider.setRange(1, 10)
        self.sensitivity_slider.setValue(5)
        self.sensitivity_slider.valueChanged.connect(
            lambda v: self.sensitivity_changed.emit(v / 10.0)
        )
        layout.addWidget(self.sensitivity_slider)
        
        # Cooldown slider
        layout.addWidget(QLabel("Cooldown (s)"))
        self.cooldown_slider = QSlider(Qt.Horizontal)
        self.cooldown_slider.setRange(1, 30)  # 0.1s to 3.0s
        self.cooldown_slider.setValue(10)  # 1.0s
        self.cooldown_slider.valueChanged.connect(
            lambda v: self.cooldown_changed.emit(v / 10.0)
        )
        layout.addWidget(self.cooldown_slider)
        
        # Confidence slider
        layout.addWidget(QLabel("Detection Confidence"))
        self.confidence_slider = QSlider(Qt.Horizontal)
        self.confidence_slider.setRange(1, 10)  # 0.1 to 1.0
        self.confidence_slider.setValue(7)  # 0.7
        self.confidence_slider.valueChanged.connect(
            lambda v: self.confidence_changed.emit(v / 10.0)
        )
        layout.addWidget(self.confidence_slider)
        
        # Platform selector
        layout.addWidget(QLabel("Platform"))
        self.platform_combo = QComboBox()
        self.platform_combo.addItems(["Generic", "YouTube", "Instagram", "TikTok"])
        self.platform_combo.currentTextChanged.connect(self.platform_changed.emit)
        layout.addWidget(self.platform_combo)
        
        # Statistics section
        layout.addSpacing(Theme.SPACING_XL)
        stats_title = QLabel("Statistics")
        stats_title.setFont(Theme.get_font(Theme.FONT_SIZE_LG, bold=True))
        layout.addWidget(stats_title)
        
        self.current_gesture_label = QLabel("Gesture: None")
        self.current_action_label = QLabel("Last Action: None")
        self.fps_stat_label = QLabel("FPS: --")
        self.inference_label = QLabel("Inference: -- ms")
        
        layout.addWidget(self.current_gesture_label)
        layout.addWidget(self.current_action_label)
        layout.addWidget(self.fps_stat_label)
        layout.addWidget(self.inference_label)
        
        layout.addStretch()
    
    def update_statistics(self, gesture: str, action: str, fps: float, inference: float):
        """Update statistics display."""
        self.current_gesture_label.setText(f"Gesture: {gesture}")
        self.current_action_label.setText(f"Last Action: {action}")
        self.fps_stat_label.setText(f"FPS: {fps:.1f}")
        self.inference_label.setText(f"Inference: {inference:.1f} ms")
    
    def set_sensitivity(self, value: float):
        """Set sensitivity slider value."""
        self.sensitivity_slider.setValue(int(value * 10))
    
    def set_cooldown(self, value: float):
        """Set cooldown slider value."""
        self.cooldown_slider.setValue(int(value * 10))
    
    def set_confidence(self, value: float):
        """Set confidence slider value."""
        self.confidence_slider.setValue(int(value * 10))
    
    def set_platform(self, platform: str):
        """Set platform combo value."""
        index = self.platform_combo.findText(platform, Qt.MatchExactly)
        if index >= 0:
            self.platform_combo.setCurrentIndex(index)


class CooldownIndicator(QWidget):
    """Visual cooldown progress indicator."""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setMinimumSize(60, 60)
        self.progress = 0.0  # 0.0 to 1.0
        self.active = False
    
    def set_progress(self, progress: float, active: bool):
        """Set cooldown progress."""
        self.progress = progress
        self.active = active
        self.update()
    
    def paintEvent(self, event):
        """Paint the cooldown indicator."""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        center_x = self.width() // 2
        center_y = self.height() // 2
        radius = min(self.width(), self.height()) // 2 - 5
        
        # Background circle
        painter.setBrush(Qt.NoBrush)
        painter.setPen(QPen(Theme.BORDER, 3))
        painter.drawEllipse(center_x - radius, center_y - radius, radius * 2, radius * 2)
        
        # Progress arc
        if self.active and self.progress > 0:
            painter.setPen(QPen(Theme.PRIMARY, 3))
            start_angle = 90 * 16  # Start at top
            span_angle = int(-360 * self.progress * 16)
            painter.drawArc(center_x - radius, center_y - radius, 
                           radius * 2, radius * 2, 
                           start_angle, span_angle)
