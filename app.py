"""
Air Gesture Shorts Controller - Application Entry Point
A production-quality desktop application for controlling video platforms with hand gestures.
"""

import sys
import logging
from pathlib import Path
from PySide6.QtWidgets import QApplication
from PySide6.QtCore import Qt
import colorlog

from ui.main_window import MainWindow


def setup_logging():
    """Configure application logging with colored output."""
    log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    
    # Colored console handler
    console_handler = colorlog.StreamHandler()
    console_handler.setFormatter(
        colorlog.ColoredFormatter(
            '%(log_color)s%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S',
            log_colors={
                'DEBUG': 'cyan',
                'INFO': 'green',
                'WARNING': 'yellow',
                'ERROR': 'red',
                'CRITICAL': 'red,bg_white',
            }
        )
    )
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(console_handler)
    
    return logging.getLogger(__name__)


def main():
    """Main application entry point."""
    # Setup logging
    logger = setup_logging()
    logger.info("Starting Air Gesture Shorts Controller")
    
    # Create Qt application
    app = QApplication(sys.argv)
    app.setApplicationName("Air Gesture Shorts Controller")
    app.setOrganizationName("ReelFlick")
    
    # Enable high DPI scaling
    app.setAttribute(Qt.AA_EnableHighDpiScaling, True)
    app.setAttribute(Qt.AA_UseHighDpiPixmaps, True)
    
    # Create and show main window
    window = MainWindow()
    window.show()
    
    logger.info("Application started successfully")
    
    # Run application
    sys.exit(app.exec())


if __name__ == '__main__':
    main()
