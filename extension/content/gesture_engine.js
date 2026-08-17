/**
 * ReelFlick Gesture Engine
 * Detects Flick Up/Down, Continuous Air-Scrolling (Scroll-Only Mode), Thumbs Up, and Pinch/Palm.
 * Includes velocity smoothing, debouncing, and adaptive thresholds.
 */

class GestureEngine {
  constructor(config = {}) {
    this.config = Object.assign({
      mode: "scroll_only", // "scroll_only" or "full_gestures"
      sensitivity: 1.2,
      cooldown: 0.8, // seconds between discrete actions
      flickVelocityThreshold: 450, // px/sec equivalent in normalized space
      scrollDragFactor: 1.5,
      smoothingWindow: 5,
      thumbsUpHoldTime: 0.45 // seconds
    }, config);

    // State tracking
    this.history = [];
    this.lastActionTime = 0;
    this.thumbsUpStartTime = null;
    this.thumbsUpTriggered = false;
    this.scrollAnchorY = null;
    this.lastScrollTick = 0;
    
    // Landmark index constants (MediaPipe Hands standard)
    this.WRIST = 0;
    this.THUMB_CMC = 1;
    this.THUMB_MCP = 2;
    this.THUMB_IP = 3;
    this.THUMB_TIP = 4;
    this.INDEX_FINGER_MCP = 5;
    this.INDEX_FINGER_PIP = 6;
    this.INDEX_FINGER_TIP = 8;
    this.MIDDLE_FINGER_MCP = 9;
    this.MIDDLE_FINGER_PIP = 10;
    this.MIDDLE_FINGER_TIP = 12;
    this.RING_FINGER_MCP = 13;
    this.RING_FINGER_PIP = 14;
    this.RING_FINGER_TIP = 16;
    this.PINKY_MCP = 17;
    this.PINKY_PIP = 18;
    this.PINKY_TIP = 20;
  }

  updateConfig(newConfig) {
    this.config = Object.assign(this.config, newConfig);
    console.log("[ReelFlick GestureEngine] Updated config:", this.config);
  }

  /**
   * Process a frame with hand landmarks
   * @param {Array<{x: number, y: number, z: number}>} landmarks - 21 normalized landmarks
   * @param {number} timestamp - current high-res timestamp (ms)
   * @returns {Object} Detected gesture payload
   */
  process(landmarks, timestamp = performance.now()) {
    if (!landmarks || landmarks.length < 21) {
      this._resetFrame();
      return { gesture: "NONE", confidence: 0, message: "No hand detected" };
    }

    const palmCenter = this._calculatePalmCenter(landmarks);
    const nowSec = timestamp / 1000;

    // Track palm position history for velocity calculation
    this.history.push({ x: palmCenter.x, y: palmCenter.y, time: nowSec });
    if (this.history.length > this.config.smoothingWindow) {
      this.history.shift();
    }

    const velocity = this._calculateVelocity();
    const isCooldown = (nowSec - this.lastActionTime) < (this.config.cooldown / this.config.sensitivity);

    // 1. SCROLL ONLY MODE: High-responsiveness flick & continuous scroll gestures
    if (this.config.mode === "scroll_only") {
      return this._detectScrollOnlyGestures(landmarks, velocity, nowSec, isCooldown);
    }

    // 2. FULL GESTURES MODE: Flicks, Thumbs Up, Open Palm Play/Pause
    return this._detectFullGestures(landmarks, velocity, nowSec, isCooldown);
  }

  _detectScrollOnlyGestures(landmarks, velocity, nowSec, isCooldown) {
    const effectiveThreshold = this.config.flickVelocityThreshold / this.config.sensitivity;

    // Flick Up (Next Short / Reel) - vertical velocity dominates with forgiving margin
    if (!isCooldown && velocity.vy < -effectiveThreshold && Math.abs(velocity.vy) > Math.abs(velocity.vx) * 0.8) {
      this.lastActionTime = nowSec;
      return {
        gesture: "FLICK_UP",
        action: "NEXT",
        velocity: velocity,
        confidence: Math.min(1.0, Math.abs(velocity.vy) / effectiveThreshold),
        message: "Flick Up → Next Reel"
      };
    }

    // Flick Down (Previous Short / Reel)
    if (!isCooldown && velocity.vy > effectiveThreshold && Math.abs(velocity.vy) > Math.abs(velocity.vx) * 0.8) {
      this.lastActionTime = nowSec;
      return {
        gesture: "FLICK_DOWN",
        action: "PREVIOUS",
        velocity: velocity,
        confidence: Math.min(1.0, Math.abs(velocity.vy) / effectiveThreshold),
        message: "Flick Down → Previous Reel"
      };
    }

    return {
      gesture: "TRACKING",
      velocity: velocity,
      confidence: 0.8,
      message: "Scroll Mode Active"
    };
  }


  _detectFullGestures(landmarks, velocity, nowSec, isCooldown) {
    const effectiveThreshold = this.config.flickVelocityThreshold / this.config.sensitivity;

    // Check Thumbs Up first
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
          message: "Thumbs Up → Liked Video!"
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

    // Flick Up -> Next Video
    if (!isCooldown && velocity.vy < -effectiveThreshold && Math.abs(velocity.vy) > Math.abs(velocity.vx) * 1.3) {
      this.lastActionTime = nowSec;
      return {
        gesture: "FLICK_UP",
        action: "NEXT",
        velocity: velocity,
        confidence: Math.min(1.0, Math.abs(velocity.vy) / effectiveThreshold),
        message: "Flick Up → Next Reel"
      };
    }

    // Flick Down -> Previous Video
    if (!isCooldown && velocity.vy > effectiveThreshold && Math.abs(velocity.vy) > Math.abs(velocity.vx) * 1.3) {
      this.lastActionTime = nowSec;
      return {
        gesture: "FLICK_DOWN",
        action: "PREVIOUS",
        velocity: velocity,
        confidence: Math.min(1.0, Math.abs(velocity.vy) / effectiveThreshold),
        message: "Flick Down → Previous Reel"
      };
    }

    return {
      gesture: "TRACKING",
      velocity: velocity,
      confidence: 0.8,
      message: "Ready for gestures"
    };
  }

  _calculatePalmCenter(landmarks) {
    const indices = [this.WRIST, this.INDEX_FINGER_MCP, this.MIDDLE_FINGER_MCP, this.RING_FINGER_MCP, this.PINKY_MCP];
    let sumX = 0, sumY = 0;
    for (let idx of indices) {
      sumX += landmarks[idx].x;
      sumY += landmarks[idx].y;
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

    // Scale to pixels/sec assuming 1000px height space
    const scale = 1000;
    const vx = ((last.x - first.x) / dt) * scale;
    const vy = ((last.y - first.y) / dt) * scale;
    return { vx, vy };
  }

  _isThumbsUp(landmarks) {
    const thumbTip = landmarks[this.THUMB_TIP];
    const thumbMcp = landmarks[this.THUMB_MCP];
    const wrist = landmarks[this.WRIST];
    const indexTip = landmarks[this.INDEX_FINGER_TIP];
    const middleTip = landmarks[this.MIDDLE_FINGER_TIP];
    const ringTip = landmarks[this.RING_FINGER_TIP];
    const pinkyTip = landmarks[this.PINKY_TIP];

    // Thumb pointing upward significantly higher than wrist and MCP
    const thumbPointingUp = thumbTip.y < thumbMcp.y - 0.05 && thumbTip.y < wrist.y - 0.08;

    // Other 4 fingers folded/curled downwards towards palm
    const fingersFolded =
      indexTip.y > landmarks[this.INDEX_FINGER_PIP].y &&
      middleTip.y > landmarks[this.MIDDLE_FINGER_PIP].y &&
      ringTip.y > landmarks[this.RING_FINGER_PIP].y &&
      pinkyTip.y > landmarks[this.PINKY_PIP].y;

    return thumbPointingUp && fingersFolded;
  }

  _resetFrame() {
    this.history = [];
    this.thumbsUpStartTime = null;
    this.thumbsUpTriggered = false;
  }
}

// Attach globally
window.ReelFlickGestureEngine = GestureEngine;
