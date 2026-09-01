/**
 * ReelFlick Gesture Engine
 * Detects sharp, natural hand FLICKS (isolated wrist/hand snap up or down),
 * while rejecting broad continuous body/arm movements.
 * Also detects Thumbs Up (Like) in full mode.
 */

class GestureEngine {
  constructor(config = {}) {
    this.config = Object.assign({
      mode: "scroll_only", // "scroll_only" or "full_gestures"
      sensitivity: 1.2,
      cooldown: 0.75, // Cooldown in seconds to prevent double flicks
      flickVelocityThreshold: 550, // Higher threshold so only sharp flicks trigger
      thumbsUpHoldTime: 0.45
    }, config);

    // Movement History
    this.history = [];
    this.lastActionTime = 0;
    this.thumbsUpStartTime = null;
    this.thumbsUpTriggered = false;

    // Flick State Machine
    this.flickInProgress = false;
    this.flickStartTime = 0;
    this.flickDirection = null;
    this.flickPeakVelocity = 0;

    // MediaPipe Hand Landmark Indices
    this.WRIST = 0;
    this.THUMB_TIP = 4;
    this.INDEX_FINGER_TIP = 8;
    this.INDEX_FINGER_PIP = 6;
    this.MIDDLE_FINGER_TIP = 12;
    this.MIDDLE_FINGER_PIP = 10;
    this.RING_FINGER_TIP = 16;
    this.RING_FINGER_PIP = 14;
    this.PINKY_TIP = 20;
    this.PINKY_PIP = 18;
  }

  updateConfig(newConfig) {
    this.config = Object.assign(this.config, newConfig);
  }

  process(landmarks, timestamp = performance.now()) {
    if (!landmarks || landmarks.length < 21) {
      this._resetState();
      return { gesture: "NONE", confidence: 0 };
    }

    const palm = this._getPalmCenter(landmarks);
    const nowSec = timestamp / 1000;

    // Maintain a rolling history of recent frames (150ms buffer)
    this.history.push({ x: palm.x, y: palm.y, time: nowSec });
    while (this.history.length > 0 && (nowSec - this.history[0].time) > 0.18) {
      this.history.shift();
    }

    if (this.history.length < 3) {
      return { gesture: "TRACKING", confidence: 0.5 };
    }

    const velocity = this._calculateVelocity();
    const speed = Math.sqrt(velocity.vx * velocity.vx + velocity.vy * velocity.vy);
    const effectiveCooldown = this.config.cooldown / Math.max(0.6, this.config.sensitivity);
    const isCooldown = (nowSec - this.lastActionTime) < effectiveCooldown;

    // 1. Check Flick Gesture (Sharp impulse)
    const flickResult = this._detectSharpFlick(velocity, speed, nowSec, isCooldown);
    if (flickResult.action) {
      return flickResult;
    }

    // 2. In Full Gestures mode, check Thumbs Up (when hand is steady)
    if (this.config.mode === "full_gestures" && speed < 180) {
      const thumbsResult = this._detectThumbsUp(landmarks, nowSec, isCooldown);
      if (thumbsResult.action) {
        return thumbsResult;
      }
    } else {
      this.thumbsUpStartTime = null;
      this.thumbsUpTriggered = false;
    }

    return {
      gesture: "TRACKING",
      velocity,
      confidence: 0.8
    };
  }

  _detectSharpFlick(velocity, speed, nowSec, isCooldown) {
    // Dynamic threshold based on sensitivity
    const threshold = this.config.flickVelocityThreshold / Math.max(0.5, this.config.sensitivity);

    // Require strong vertical dominance: vertical velocity must be at least 1.4x horizontal
    const isVerticalDominant = Math.abs(velocity.vy) > Math.abs(velocity.vx) * 1.4;

    // If on cooldown or movement is too slow or horizontal, reset flick state
    if (isCooldown || speed < (threshold * 0.5) || !isVerticalDominant) {
      this.flickInProgress = false;
      this.flickStartTime = 0;
      this.flickDirection = null;
      this.flickPeakVelocity = 0;
      return { gesture: "NONE" };
    }

    // Step 1: Detect Start of a Sharp Flick Impulse
    if (!this.flickInProgress && Math.abs(velocity.vy) > threshold) {
      this.flickInProgress = true;
      this.flickStartTime = nowSec;
      this.flickDirection = velocity.vy < 0 ? "UP" : "DOWN";
      this.flickPeakVelocity = Math.abs(velocity.vy);
      return { gesture: "FLICK_START" };
    }

    // Step 2: Track Active Flick
    if (this.flickInProgress) {
      const duration = nowSec - this.flickStartTime;
      const currentDir = velocity.vy < 0 ? "UP" : "DOWN";

      if (Math.abs(velocity.vy) > this.flickPeakVelocity) {
        this.flickPeakVelocity = Math.abs(velocity.vy);
      }

      // Check if flick was completed in a quick burst (0.05s - 0.35s)
      if (duration >= 0.05 && duration <= 0.35 && currentDir === this.flickDirection) {
        // Trigger action
        this.lastActionTime = nowSec;
        this.flickInProgress = false;
        this.flickStartTime = 0;

        if (this.flickDirection === "UP") {
          return {
            gesture: "FLICK_UP",
            action: "NEXT",
            confidence: Math.min(1.0, this.flickPeakVelocity / threshold),
            message: "Flick Up ➔ Next Reel"
          };
        } else {
          return {
            gesture: "FLICK_DOWN",
            action: "PREVIOUS",
            confidence: Math.min(1.0, this.flickPeakVelocity / threshold),
            message: "Flick Down ➔ Previous Reel"
          };
        }
      }

      // If flick dragged on too long (> 0.35s), it was a full hand drag, not a quick flick!
      if (duration > 0.35) {
        this.flickInProgress = false;
        this.flickStartTime = 0;
      }
    }

    return { gesture: "NONE" };
  }

  _detectThumbsUp(landmarks, nowSec, isCooldown) {
    if (isCooldown) return { gesture: "NONE" };

    const thumbTip = landmarks[this.THUMB_TIP];
    const wrist = landmarks[this.WRIST];
    const indexTip = landmarks[this.INDEX_FINGER_TIP];
    const indexPip = landmarks[this.INDEX_FINGER_PIP];
    const middleTip = landmarks[this.MIDDLE_FINGER_TIP];
    const middlePip = landmarks[this.MIDDLE_FINGER_PIP];

    if (!thumbTip || !wrist || !indexTip || !middleTip) return { gesture: "NONE" };

    // Thumb pointing upward significantly higher than wrist
    const thumbUp = thumbTip.y < wrist.y - 0.12;

    // Fingers curled in (tips below PIP joints)
    const fingersCurled = (indexTip.y > indexPip.y) && (middleTip.y > middlePip.y);

    if (thumbUp && fingersCurled) {
      if (!this.thumbsUpStartTime) {
        this.thumbsUpStartTime = nowSec;
      } else if (!this.thumbsUpTriggered && (nowSec - this.thumbsUpStartTime) >= this.config.thumbsUpHoldTime) {
        this.thumbsUpTriggered = true;
        this.lastActionTime = nowSec;
        return {
          gesture: "THUMBS_UP",
          action: "LIKE",
          confidence: 0.95,
          message: "Thumbs Up ➔ Liked Video!"
        };
      }
      return {
        gesture: "HOLDING_THUMBS_UP",
        confidence: Math.min(1.0, (nowSec - this.thumbsUpStartTime) / this.config.thumbsUpHoldTime)
      };
    } else {
      this.thumbsUpStartTime = null;
      this.thumbsUpTriggered = false;
    }

    return { gesture: "NONE" };
  }

  _getPalmCenter(landmarks) {
    const indices = [0, 5, 9, 13, 17];
    let sx = 0, sy = 0;
    for (let idx of indices) {
      sx += landmarks[idx].x;
      sy += landmarks[idx].y;
    }
    return { x: sx / indices.length, y: sy / indices.length };
  }

  _calculateVelocity() {
    if (this.history.length < 2) return { vx: 0, vy: 0 };
    const first = this.history[0];
    const last = this.history[this.history.length - 1];
    const dt = last.time - first.time;
    if (dt <= 0.001) return { vx: 0, vy: 0 };

    const scale = 1000;
    return {
      vx: ((last.x - first.x) / dt) * scale,
      vy: ((last.y - first.y) / dt) * scale
    };
  }

  _resetState() {
    this.history = [];
    this.flickInProgress = false;
    this.flickStartTime = 0;
    this.thumbsUpStartTime = null;
    this.thumbsUpTriggered = false;
  }
}

// Attach globally
window.ReelFlickGestureEngine = GestureEngine;
