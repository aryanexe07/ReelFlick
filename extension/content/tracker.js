/**
 * ReelFlick In-Browser Hand Tracker
 * Powered by local bundled MediaPipe Hands with ML hand-landmark detection.
 * Specifically detects hands only (strictly ignores faces, bodies, and background).
 * Renders an aesthetic monochrome silver/chalk-white skeleton HUD.
 */

class HandTracker {
  constructor(videoElement, canvasElement, onResults) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext("2d");
    this.onResults = onResults;

    this.stream = null;
    this.isRunning = false;
    this.animFrameId = null;
    this.mediaPipeHands = null;
    this.isMediaPipeReady = false;
    this.isProcessingFrame = false;
  }

  async start() {
    if (this.isRunning) return true;

    try {
      console.log("[ReelFlick HandTracker] Initializing camera and MediaPipe Hands...");

      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
          frameRate: { ideal: 30 }
        },
        audio: false
      };

      try {
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e1) {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      this.video.srcObject = this.stream;
      this.video.muted = true;
      this.video.setAttribute("playsinline", "true");

      await this.video.play();
      this.isRunning = true;

      // Initialize local MediaPipe Hands
      await this._initMediaPipe();

      this._loop();
      console.log("[ReelFlick HandTracker] Camera & Hand Tracking started.");
      return true;
    } catch (err) {
      console.error("[ReelFlick HandTracker] Start error:", err);
      this.stop();
      throw err;
    }
  }

  stop() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => {
        try { t.stop(); } catch (e) {}
      });
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
    this._clearCanvas();
    if (this.onResults) this.onResults(null);
    console.log("[ReelFlick HandTracker] Camera stopped.");
  }

  async _initMediaPipe() {
    if (this.mediaPipeHands) return;

    try {
      const locateFile = (file) => {
        if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
          return chrome.runtime.getURL(`lib/${file}`);
        }
        return `lib/${file}`;
      };

      if (typeof window.Hands !== "undefined") {
        this.mediaPipeHands = new window.Hands({ locateFile });
        this.mediaPipeHands.setOptions({
          maxNumHands: 1,
          modelComplexity: 0,
          minDetectionConfidence: 0.55,
          minTrackingConfidence: 0.5
        });

        this.mediaPipeHands.onResults((results) => {
          this.isProcessingFrame = false;
          if (!this.isRunning) return;

          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            // Hand detected by ML model!
            const rawLandmarks = results.multiHandLandmarks[0];
            // Mirror X to match mirrored video display
            const mirrored = rawLandmarks.map((p) => ({
              x: 1.0 - p.x,
              y: p.y,
              z: p.z || 0
            }));

            this.onResults(mirrored);
            this._drawSkeleton(mirrored);
          } else {
            // No hand in frame (faces and background are cleanly ignored)
            this.onResults(null);
            this._clearCanvas();
          }
        });

        this.isMediaPipeReady = true;
        console.log("[ReelFlick] MediaPipe Hands ML pipeline ready.");
      }
    } catch (e) {
      console.warn("[ReelFlick] MediaPipe init error:", e);
    }
  }

  _loop() {
    if (!this.isRunning) return;

    if (this.video && this.video.readyState >= this.video.HAVE_CURRENT_DATA) {
      const vw = this.video.videoWidth || 320;
      const vh = this.video.videoHeight || 240;

      if (this.canvas.width !== vw || this.canvas.height !== vh) {
        this.canvas.width = vw;
        this.canvas.height = vh;
      }

      if (this.isMediaPipeReady && this.mediaPipeHands && !this.isProcessingFrame) {
        this.isProcessingFrame = true;
        this.mediaPipeHands.send({ image: this.video }).catch(() => {
          this.isProcessingFrame = false;
        });
      }
    }

    this.animFrameId = requestAnimationFrame(() => this._loop());
  }

  _drawSkeleton(landmarks) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0) return;

    this.ctx.clearRect(0, 0, w, h);

    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8], // Index
      [0, 9], [9, 10], [10, 11], [11, 12], // Middle
      [0, 13], [13, 14], [14, 15], [15, 16], // Ring
      [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
      [5, 9], [9, 13], [13, 17] // Palm
    ];

    // Draw Chalk-White / Silver Bones
    this.ctx.shadowBlur = 6;
    this.ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    this.ctx.lineWidth = 2.0;

    for (let [i, j] of connections) {
      const p1 = landmarks[i];
      const p2 = landmarks[j];
      if (p1 && p2) {
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x * w, p1.y * h);
        this.ctx.lineTo(p2.x * w, p2.y * h);
        this.ctx.stroke();
      }
    }

    // Draw Glowing Chalk Joints
    this.ctx.shadowBlur = 8;
    this.ctx.shadowColor = "#ffffff";

    for (let idx = 0; idx < landmarks.length; idx++) {
      const p = landmarks[idx];
      if (!p) continue;
      const isTip = [4, 8, 12, 16, 20].includes(idx);
      this.ctx.fillStyle = isTip ? "#ffffff" : "#d4d4d8";
      this.ctx.beginPath();
      this.ctx.arc(p.x * w, p.y * h, isTip ? 3.5 : 2.0, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  _clearCanvas() {
    if (this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}

// Attach globally
window.ReelFlickHandTracker = HandTracker;
