# Air Gesture Shorts Controller

A production-quality desktop application that lets you control YouTube Shorts, Instagram Reels, and TikTok using hand gestures captured from your webcam. Navigate short-form videos naturally without touching your keyboard or mouse.

![Python](https://img.shields.io/badge/python-3.12+-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

## Features

- **Flick Up** - Scroll to the next reel/short with a quick upward hand gesture
- **Flick Down** - Go back to the previous reel (where supported) with a downward gesture
- **Thumbs Up** - Like the current video by holding a thumbs-up pose for 0.5 seconds
- **Real-time Detection** - Powered by MediaPipe for fast, accurate hand tracking
- **Cross-platform** - Works with YouTube, Instagram, TikTok, and generic video platforms
- **Modern UI** - Beautiful dark mode interface inspired by Linear and Raycast
- **Configurable** - Adjust sensitivity, cooldown, and detection confidence to your preference
- **Offline** - Works completely offline after installation, no cloud APIs required

## Screenshots

*Coming soon*

## Installation

### Prerequisites

- Python 3.12 or higher
- A webcam
- Windows, macOS, or Linux

### Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/reelflick.git
cd reelflick
```

2. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the application:
```bash
python app.py
```

## Usage

1. **Launch the application** - Start the app and click "Start Camera"
2. **Position your hand** - Hold your hand 30-50cm from the camera with good lighting
3. **Use gestures**:
   - **Flick Up**: Quickly move your hand upward to go to the next video
   - **Flick Down**: Quickly move your hand downward to go to the previous video
   - **Thumbs Up**: Hold a thumbs-up pose for 0.5 seconds to like the video
4. **Adjust settings** - Use the side panel to fine-tune sensitivity and cooldown

## Architecture

The application follows a clean, modular architecture:

```
project/
├── app.py                      # Application entry point
├── requirements.txt            # Python dependencies
├── README.md                   # This file
│
├── core/                       # Core functionality
│   ├── camera.py              # Webcam handling
│   ├── hand_tracker.py        # MediaPipe hand tracking
│   ├── gesture_detector.py    # Gesture recognition logic
│   ├── action_executor.py     # Keyboard/mouse actions
│   ├── cooldown.py            # Action cooldown management
│   └── settings.py            # Configuration management
│
├── ui/                         # User interface
│   ├── main_window.py         # Main application window
│   ├── widgets.py             # Custom UI components
│   └── theme.py               # Dark mode styling
│
├── assets/                     # Static assets
└── config/                     # Configuration files
    └── config.json            # Default settings
```

### Core Components

- **Camera Module** (`core/camera.py`): Handles webcam detection, initialization, and frame capture with graceful error recovery
- **Hand Tracker** (`core/hand_tracker.py`): Uses MediaPipe Hands for real-time hand landmark detection
- **Gesture Detector** (`core/gesture_detector.py`): Implements flick and thumbs-up gesture detection with debouncing and smoothing
- **Action Executor** (`core/action_executor.py`): Executes keyboard shortcuts for different video platforms
- **Cooldown Manager** (`core/cooldown.py`): Prevents accidental rapid successive actions
- **Settings Manager** (`core/settings.py`): Handles configuration persistence with JSON storage

### UI Components

- **Main Window** (`ui/main_window.py`): Integrates all components and manages the application lifecycle
- **Camera Widget** (`ui/widgets.py`): Displays webcam feed with gesture overlays and animations
- **Settings Panel** (`ui/widgets.py`): Provides controls for sensitivity, cooldown, and platform selection
- **Theme** (`ui/theme.py`): Defines the dark mode color palette and styling

## Configuration

Settings are automatically saved to `config/config.json`. You can modify:

- **Camera ID**: Select which webcam to use
- **Detection Confidence**: Minimum confidence for hand detection (0.1-1.0)
- **Velocity Threshold**: Minimum speed for flick detection (pixels/second)
- **Thumbs Up Duration**: Time to hold thumbs-up pose (seconds)
- **Cooldown Duration**: Delay between actions (seconds)
- **Platform**: Target platform (YouTube, Instagram, TikTok, Generic)

## Gesture Detection

The gesture detector prioritizes precision over sensitivity to avoid accidental triggers:

### Flick Detection
- Tracks palm center velocity
- Requires fast, intentional movement
- Validates direction (up/down)
- Checks flick duration (0.1-0.5 seconds)
- Uses velocity smoothing to reduce jitter

### Thumbs Up Detection
- Requires thumb extended above other fingers
- All other fingers must be folded
- Hand must be upright
- Must hold pose for 0.5 seconds
- Uses hysteresis to prevent false positives

### Cooldown System
After any successful action, a 1-second cooldown prevents accidental triggers. The cooldown progress is displayed visually in the UI.

## Platform Support

The application supports keyboard shortcuts for different platforms:

| Platform | Next | Previous | Like |
|----------|------|----------|------|
| YouTube | `j` | `k` | `l` |
| Instagram | `↓` | `↑` | `l` |
| TikTok | `↓` | `↑` | `l` |
| Generic | `↓` | `↑` | `l` |

## Performance

- **Target FPS**: 60
- **Detection Latency**: < 50ms
- **CPU Usage**: Optimized for efficient processing
- **Memory**: Minimal footprint with efficient resource management

## Troubleshooting

### Camera not detected
- Ensure your webcam is properly connected
- Try changing the camera ID in Settings
- Check that no other application is using the camera

### Gestures not detected
- Improve lighting conditions
- Move your hand closer to the camera (30-50cm)
- Increase sensitivity in the settings panel
- Ensure your hand is clearly visible in the frame

### Actions not triggering
- Make sure the video platform window is active
- Check that the correct platform is selected in settings
- Verify keyboard shortcuts work manually on the platform
- Reduce cooldown duration if actions feel delayed

### High CPU usage
- Lower the camera resolution in settings
- Reduce the target FPS
- Close other applications that may be using the webcam

## Roadmap

- [ ] Add sound feedback for gesture confirmation
- [ ] Support for custom keyboard shortcuts
- [ ] Multi-hand tracking for advanced gestures
- [ ] Browser extension for direct integration
- [ ] Gesture recording and replay
- [ ] Statistics dashboard with usage analytics
- [ ] Voice command integration
- [ ] Mobile companion app

## Known Limitations

- Requires the video platform window to be active for keyboard shortcuts to work
- Performance depends on webcam quality and lighting conditions
- Previous video navigation not supported on all platforms
- May not work with all keyboard layouts

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code follows PEP8 guidelines and includes appropriate tests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [MediaPipe](https://google.github.io/mediapipe/) for hand tracking
- [OpenCV](https://opencv.org/) for computer vision
- [PySide6](https://www.qt.io/) for the UI framework
- Inspired by modern gesture-controlled interfaces

## Support

If you encounter any issues or have questions:

- Open an issue on GitHub
- Check existing issues for solutions
- Review the troubleshooting section above

## Star History

If you find this project useful, please consider giving it a star ⭐

---

Made with ❤️ by the ReelFlick team
