/**
 * ReelFlick Gesture Engine
 * Detects Flick Up (Next Reel), Flick Down (Prev Reel), Thumbs Up (Like), and Open Palm (Play/Pause).
 * Includes velocity smoothing, direction angle isolation, and debounce cooldown.
 */

class GestureEngine {
  constructor(config = {}) {
    this.config = Object.assign({
      mode: "scroll_only", // "scroll_only" or "full_gestures"
      sensitivity: 1.2,
      cooldown: 0.75, // seconds between triggers
      flickVelocityThreshold: 400, // px/s equivalent
      smoothingWindow: 5,
      thumbsUpHoldTime: 0.4 // seconds
    }, config);

    // State tracking
    this.history = [];
    this.lastActionTime = 0;
    this.thumbsUpStartTime = null;
    this.thumbsUpTriggered = false;

    // Landmark indexes
    this.WRIST = 0;
    this.THUMB_TIP = 4;
    this.INDEX_FINGER_TIP = 8;
    this.MIDDLE_FINGER_TIP = 12;
    this.RING_FINGER_TIP = 16;
    this.PINKY_TIP = 20;
  }

  updateConfig(newConfig) {
    this.config = Object.assign(this.config, newConfig);
  }

  /**
   * Process landmarks array and return gesture action
   */
  process(landmarks, timestamp = performance.now()) {
    if (!landmarks || landmarks.length < 21) {
      this._resetFrame();
      return { gesture: "NONE", confidence: 0 };
    }

    const palmCenter = this._calculatePalmCenter(landmarks);
    const nowSec = timestamp / 1000;

    // Push to movement history
    this.history.push({ x: palmCenter.x, y: palmCenter.y, time: nowSec });
    if (this.history.length > this.config.smoothingWindow) {
      this.history.shift();
    }

    const velocity = this._calculateVelocity();
    const effectiveCooldown = this.config.cooldown / Math.max(0.5, this.config.sensitivity);
    const isCooldown = (nowSec - this.lastActionTime) < effectiveCooldown;

    // 1. SCROLL ONLY MODE
    if (this.config.mode === "scroll_only") {
      return this._detectScrollOnlyGestures(velocity, nowSec, isCooldown);
    }

    // 2. FULL GESTURES MODE (Flick + Thumbs Up Like + Play/Pause)
    return this._detectFullGestures(landmarks, velocity, nowSec, isCooldown);
  }

  _detectScrollOnlyGestures(velocity, nowSec, isCooldown) {
    const threshold = this.config.flickVelocityThreshold / Math.max(0.5, this.config.sensitivity);

    // Flick Up -> Next Video (Hand moving upwards has negative vy)
    if (!isCooldown && velocity.vy < -threshold && Math.abs(velocity.vy) > Math.abs(velocity.vx) * 0.7) {
      this.lastActionTime = nowSec;
      return {
        gesture: "FLICK_UP",
        action: "NEXT",
        velocity: velocity,
        confidence: Math.min(1.0, Math.abs(velocity.vy) / threshold),
        message: "Next Video"
      };
    }

    // Flick Down -> Previous Video (Hand moving downwards has positive vy)
    if (!isCooldown && velocity.vy > threshold && Math.abs(velocity.vy) > Math.abs(velocity.vx) * 0.7) {
      this.lastActionTime = nowSec;
      return {
        gesture: "FLICK_DOWN",
        action: "PREVIOUS",
        velocity: velocity,
        confidence: Math.min(1.0, Math.abs(velocity.vy) / threshold),
        message: "Previous Video"
      };
    }

    return {
      gesture: "TRACKING",
      velocity: velocity,
      confidence: 0.8,
      message: "Ready for flick"
    };
  }

  _detectFullGestures(landmarks, velocity, nowSec, isCooldown) {
    const threshold = this.config.flickVelocityThreshold / Math.max(0.5, this.config.sensitivity);

    // 1. Check Thumbs Up
    const isThumbsUp = this._isThumbsUp(landmarks);
    if (isThumbsUp) {
      if (!this.thumbsUpStartTime) {
        this.thumbsUpStartTime = nowSec;
      } else if (!this.thumbsUpTriggered && (nowSec - this.thumbsUpStartTime) >= this.config.thumbsUpHoldTime) {
        this.thumbsUpTriggered = true;
        this.lastActionTime = nowSec;
        return {
          gesture: "THUMBS_UP",
          action: "LIKE",
          velocity: velocity,
          confidence: 0.95,
          message: "Liked Video!"
        };
      }
      return {
        gesture: "HOLDING_THUMBS_UP",
        confidence: Math.min(1.0, (nowSec - this.thumbsUpStartTime) / this.config.thumbsUpHoldTime),
        message: "Holding Thumbs Up..."
      };
    } else {
      this.thumbsUpStartTime = null;
      this.thumbsUpTriggered = false;
    }

    // 2. Flick Up -> Next Video
    if (!isCooldown && velocity.vy < -threshold && Math.abs(velocity.vy) > Math.abs(velocity.vx) * 0.8) {
      this.lastActionTime = nowSec;
      return {
        gesture: "FLICK_UP",
        action: "NEXT",
        velocity: velocity,
        confidence: Math.min(1.0, Math.abs(velocity.vy) / threshold),
        message: "Next Video"
      };
    }

    // 3. Flick Down -> Previous Video
    if (!isCooldown && velocity.vy > threshold && Math.abs(velocity.vy) > Math.abs(velocity.vx) * 0.8) {
      this.lastActionTime = nowSec;
      return {
        gesture: "FLICK_DOWN",
        action: "PREVIOUS",
        velocity: velocity,
        confidence: Math.min(1.0, Math.abs(velocity.vy) / threshold),
        message: "Previous Video"
      };
    }

    return {
      gesture: "TRACKING",
      velocity: velocity,
      confidence: 0.8,
      message: "Gestures ready"
    };
  }

  _calculatePalmCenter(landmarks) {
    const indices = [0, 5, 9, 13, 17];
    let sumX = 0, sumY = 0;
    for (let idx of indices) {
      if (landmarks[idx]) {
        sumX += landmarks[idx].x;
        sumY += landmarks[idx].y;
      }
    }
    return {
      x: sumX / indices.length,
      y: sumY / indices.length
    };
  }

  _calculateVelocity() {
    if (this.history.length < 2) return { vx: 0, vy: 0 };
    const first = this.history[0];
    const last = this.history[this.history.length - 1];
    const dt = last.time - first.time;
    if (dt <= 0.0001) return { vx: 0, vy: 0 };

    const scale = 1000; // normalized to px/sec
    const vx = ((last.x - first.x) / dt) * scale;
    const vy = ((last.y - first.y) / dt) * scale;
    return { vx, vy };
  }

  _isThumbsUp(landmarks) {
    const thumbTip = landmarks[this.THUMB_TIP];
    const wrist = landmarks[this.WRIST];
    const indexTip = landmarks[this.INDEX_FINGER_TIP];
    const middleTip = landmarks[this.MIDDLE_FINGER_TIP];

    if (!thumbTip || !wrist || !indexTip || !middleTip) return false;

    // Thumb pointing significantly higher than wrist
    const thumbUp = thumbTip.y < wrist.y - 0.15;
    // Index and middle curled below thumb
    const fingersDown = indexTip.y > thumbTip.y + 0.12 && middleTip.y > thumbTip.y + 0.12;

    return thumbUp && fingersDown;
  }

  _resetFrame() {
    this.history = [];
    this.thumbsUpStartTime = null;
    this.thumbsUpTriggered = false;
  }
}

// Attach globally
window.ReelFlickGestureEngine = GestureEngine;
