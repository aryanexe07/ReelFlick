"""
Theme module for UI styling.
Provides dark mode color palette and styling constants inspired by modern apps.
"""

from PySide6.QtGui import QColor, QPalette, QFont
from PySide6.QtCore import Qt
from typing import Dict


class Theme:
    """Dark mode theme colors and styling."""
    
    # Primary colors (Monochrome Charcoal & Chalk White)
    PRIMARY = QColor("#ffffff")  # Chalk White
    PRIMARY_HOVER = QColor("#e4e4e7")
    PRIMARY_PRESSED = QColor("#d4d4d8")
    
    # Background colors
    BACKGROUND = QColor("#09090b")  # Pitch Matte Black
    SURFACE = QColor("#121215")  # Matte Charcoal
    SURFACE_LIGHT = QColor("#1c1c22")
    
    # Text colors
    TEXT_PRIMARY = QColor("#f4f4f5")
    TEXT_SECONDARY = QColor("#a1a1aa")
    TEXT_DISABLED = QColor("#52525b")
    
    # Accent colors
    ACCENT_GREEN = QColor("#22c55e")  # Emerald
    ACCENT_BLUE = QColor("#ffffff")  # White
    ACCENT_RED = QColor("#ef4444")  # Red
    ACCENT_YELLOW = QColor("#eab308")  # Amber
    
    # Status colors
    SUCCESS = ACCENT_GREEN
    WARNING = ACCENT_YELLOW
    ERROR = ACCENT_RED
    INFO = ACCENT_BLUE
    
    # Border colors
    BORDER = QColor("#27272a")
    BORDER_LIGHT = QColor("#3f3f46")
    
    # Glassmorphism
    GLASS_BACKGROUND = QColor(30, 30, 30, 200)
    GLASS_BORDER = QColor(255, 255, 255, 30)
    
    # Spacing
    SPACING_XS = 4
    SPACING_SM = 8
    SPACING_MD = 16
    SPACING_LG = 24
    SPACING_XL = 32
    
    # Border radius
    RADIUS_SM = 4
    RADIUS_MD = 8
    RADIUS_LG = 12
    RADIUS_XL = 16
    
    # Typography
    FONT_FAMILY = "Segoe UI, Arial, sans-serif"
    FONT_SIZE_XS = 10
    FONT_SIZE_SM = 12
    FONT_SIZE_MD = 14
    FONT_SIZE_LG = 16
    FONT_SIZE_XL = 20
    FONT_SIZE_XXL = 24
    
    @staticmethod
    def get_palette() -> QPalette:
        """
        Get dark mode palette for application.
        
        Returns:
            QPalette configured for dark mode
        """
        palette = QPalette()
        
        # Window colors
        palette.setColor(QPalette.Window, Theme.BACKGROUND)
        palette.setColor(QPalette.WindowText, Theme.TEXT_PRIMARY)
        
        # Widget colors
        palette.setColor(QPalette.Base, Theme.SURFACE)
        palette.setColor(QPalette.AlternateBase, Theme.SURFACE_LIGHT)
        palette.setColor(QPalette.Text, Theme.TEXT_PRIMARY)
        
        # Button colors
        palette.setColor(QPalette.Button, Theme.SURFACE)
        palette.setColor(QPalette.ButtonText, Theme.TEXT_PRIMARY)
        
        # Highlight colors
        palette.setColor(QPalette.Highlight, Theme.PRIMARY)
        palette.setColor(QPalette.HighlightedText, Theme.TEXT_PRIMARY)
        
        # Link colors
        palette.setColor(QPalette.Link, Theme.ACCENT_BLUE)
        palette.setColor(QPalette.LinkVisited, Theme.ACCENT_BLUE)
        
        return palette
    
    @staticmethod
    def get_font(size: int = FONT_SIZE_MD, bold: bool = False) -> QFont:
        """
        Get themed font.
        
        Args:
            size: Font size
            bold: Whether font is bold
            
        Returns:
            QFont with theme settings
        """
        font = QFont(Theme.FONT_FAMILY, size)
        if bold:
            font.setBold(True)
        return font
    
    @staticmethod
    def get_stylesheet() -> str:
        """
        Get complete stylesheet for dark mode.
        
        Returns:
            CSS stylesheet string
        """
        return f"""
            QMainWindow {{
                background-color: {Theme.BACKGROUND.name()};
            }}
            
            QWidget {{
                background-color: transparent;
                color: {Theme.TEXT_PRIMARY.name()};
                font-family: {Theme.FONT_FAMILY};
                font-size: {Theme.FONT_SIZE_MD}px;
            }}
            
            QPushButton {{
                background-color: {Theme.SURFACE.name()};
                color: {Theme.TEXT_PRIMARY.name()};
                border: 1px solid {Theme.BORDER.name()};
                border-radius: {Theme.RADIUS_MD}px;
                padding: {Theme.SPACING_SM}px {Theme.SPACING_MD}px;
                font-size: {Theme.FONT_SIZE_MD}px;
            }}
            
            QPushButton:hover {{
                background-color: {Theme.SURFACE_LIGHT.name()};
                border-color: {Theme.BORDER_LIGHT.name()};
            }}
            
            QPushButton:pressed {{
                background-color: {Theme.PRIMARY.name()};
            }}
            
            QPushButton:disabled {{
                background-color: {Theme.SURFACE.name()};
                color: {Theme.TEXT_DISABLED.name()};
                border-color: {Theme.BORDER.name()};
            }}
            
            QSlider::groove:horizontal {{
                height: 4px;
                background: {Theme.BORDER.name()};
                border-radius: 2px;
            }}
            
            QSlider::handle:horizontal {{
                width: 16px;
                height: 16px;
                background: {Theme.PRIMARY.name()};
                border-radius: 8px;
                margin: -6px 0;
            }}
            
            QSlider::handle:horizontal:hover {{
                background: {Theme.PRIMARY_HOVER.name()};
            }}
            
            QLabel {{
                color: {Theme.TEXT_PRIMARY.name()};
            }}
            
            QFrame {{
                background-color: {Theme.SURFACE.name()};
                border: 1px solid {Theme.BORDER.name()};
                border-radius: {Theme.RADIUS_MD}px;
            }}
            
            QScrollArea {{
                background-color: transparent;
                border: none;
            }}
            
            QComboBox {{
                background-color: {Theme.SURFACE.name()};
                color: {Theme.TEXT_PRIMARY.name()};
                border: 1px solid {Theme.BORDER.name()};
                border-radius: {Theme.RADIUS_MD}px;
                padding: {Theme.SPACING_SM}px;
            }}
            
            QComboBox:hover {{
                border-color: {Theme.BORDER_LIGHT.name()};
            }}
            
            QComboBox::drop-down {{
                border: none;
            }}
            
            QComboBox::down-arrow {{
                image: none;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-top: 5px solid {Theme.TEXT_SECONDARY.name()};
            }}
        """
