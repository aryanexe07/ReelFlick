/**
 * ReelFlick In-Browser Hand Tracker
 * Powered by local bundled MediaPipe Hands with ML hand-landmark detection.
 * Renders an ultra-clean, high-tech monochrome cinematic viewfinder HUD overlay:
 * - Dynamic palm targeting reticle & cyber halo
 * - Tapered chalk-white skeleton lines with luminous outer bloom
 * - Pulsing fingertip status nodes
 * - Viewfinder corner brackets & HUD telemetry
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

    // Animation state
    this.pulsePhase = 0;
    this.lastPalmX = 0.5;
    this.lastPalmY = 0.5;
  }

  async start() {
    if (this.isRunning) return true;

    try {
      console.log("[ReelFlick HandTracker] Initializing camera & MediaPipe Hands ML...");

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
      console.log("[ReelFlick HandTracker] Camera & ML tracking active.");
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
            this._drawCyberHUD(mirrored);
          } else {
            // No hand in frame (strictly clear canvas, faces ignored)
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

  _loop(timestamp = performance.now()) {
    if (!this.isRunning) return;

    this.pulsePhase = (timestamp / 1000) * 3.5;

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

    this.animFrameId = requestAnimationFrame((t) => this._loop(t));
  }

  _drawCyberHUD(landmarks) {
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
      [5, 9], [9, 13], [13, 17] // Palm Base
    ];

    // 1. Calculate Palm Center for Targeting Halo
    const palmIndices = [0, 5, 9, 13, 17];
    let palmX = 0, palmY = 0;
    for (let idx of palmIndices) {
      palmX += landmarks[idx].x;
      palmY += landmarks[idx].y;
    }
    palmX = (palmX / palmIndices.length) * w;
    palmY = (palmY / palmIndices.length) * h;

    // Smooth palm position
    this.lastPalmX += (palmX - this.lastPalmX) * 0.4;
    this.lastPalmY += (palmY - this.lastPalmY) * 0.4;

    // 2. Draw Palm Target Reticle & Cyber Ring
    const haloRadius = 18 + Math.sin(this.pulsePhase) * 2.5;
    this.ctx.save();
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    this.ctx.lineWidth = 1.2;
    this.ctx.setLineDash([4, 4]);
    this.ctx.beginPath();
    this.ctx.arc(this.lastPalmX, this.lastPalmY, haloRadius, 0, Math.PI * 2);
    this.ctx.stroke();

    // Central crosshair pip
    this.ctx.setLineDash([]);
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    this.ctx.beginPath();
    this.ctx.arc(this.lastPalmX, this.lastPalmY, 2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // 3. Draw Chalk-White / Silver Bones
    this.ctx.save();
    this.ctx.shadowBlur = 8;
    this.ctx.shadowColor = "rgba(255, 255, 255, 0.9)";
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.88)";
    this.ctx.lineWidth = 2.2;
    this.ctx.lineCap = "round";

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
    this.ctx.restore();

    // 4. Draw Intermediate Knuckle Nodes
    for (let idx = 0; idx < landmarks.length; idx++) {
      const p = landmarks[idx];
      if (!p) continue;

      const isTip = [4, 8, 12, 16, 20].includes(idx);
      if (!isTip) {
        this.ctx.fillStyle = "rgba(212, 212, 216, 0.9)";
        this.ctx.beginPath();
        this.ctx.arc(p.x * w, p.y * h, 2.0, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // 5. Draw Luminous Fingertip Status Nodes with Pulse Rings
    for (let tipIdx of [4, 8, 12, 16, 20]) {
      const tip = landmarks[tipIdx];
      if (!tip) continue;

      const tx = tip.x * w;
      const ty = tip.y * h;

      // Outer delicate pulse ring
      const tipPulse = 5.5 + Math.sin(this.pulsePhase + tipIdx) * 1.5;
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.arc(tx, ty, tipPulse, 0, Math.PI * 2);
      this.ctx.stroke();

      // Solid chalk-white core
      this.ctx.save();
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = "#ffffff";
      this.ctx.fillStyle = "#ffffff";
      this.ctx.beginPath();
      this.ctx.arc(tx, ty, 3.5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
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
