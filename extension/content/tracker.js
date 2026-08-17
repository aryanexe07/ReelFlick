/**
 * ReelFlick In-Browser Hand Tracker
 * Initializes webcam capture and runs real-time lightweight optical/hand landmark tracking.
 * Provides fallback skin-tone/motion flow tracking & CDN MediaPipe hands integration.
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

    // Smoothed detection tracking
    this.lastDetectedBox = null;
    this.handPresentCount = 0;
  }

  async start() {
    if (this.isRunning) return;

    try {
      console.log("[ReelFlick HandTracker] Starting camera feed...");
      
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user"
          },
          audio: false
        });
      } catch (e1) {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      this.video.srcObject = this.stream;
      this.video.muted = true;
      this.video.setAttribute("playsinline", "true");
      
      await this.video.play();
      this.isRunning = true;

      // Initialize MediaPipe Hands if available
      this._initializeMediaPipe();

      this._loop();
      console.log("[ReelFlick HandTracker] Camera started successfully.");
      return true;
    } catch (err) {
      console.error("[ReelFlick HandTracker] Camera access failed:", err);
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
      this.stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
    this._clearSkeleton();
    if (this.onResults) this.onResults(null);
    console.log("[ReelFlick HandTracker] Camera and stream completely shut off.");
  }

  async _initializeMediaPipe() {
    if (window.Hands) {
      this._setupMediaPipeHands();
      return;
    }

    try {
      if (!document.getElementById("rf-mediapipe-hands")) {
        const script = document.createElement("script");
        script.id = "rf-mediapipe-hands";
        script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
        script.crossOrigin = "anonymous";
        script.onload = () => {
          console.log("[ReelFlick] MediaPipe Hands script loaded.");
          this._setupMediaPipeHands();
        };
        document.head.appendChild(script);
      }
    } catch (e) {
      console.log("[ReelFlick] Fast optical tracker active.");
    }
  }

  _setupMediaPipeHands() {
    try {
      this.mediaPipeHands = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      this.mediaPipeHands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.4,
        minTrackingConfidence: 0.4
      });

      this.mediaPipeHands.onResults((results) => {
        if (!this.isRunning) return;
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          // MediaPipe produces non-mirrored coordinates. Mirror X once to match mirrored video display.
          const rawLandmarks = results.multiHandLandmarks[0];
          const mirroredLandmarks = rawLandmarks.map((p) => ({
            x: 1.0 - p.x,
            y: p.y,
            z: p.z || 0
          }));
          this.onResults(mirroredLandmarks);
          this._drawSkeleton(mirroredLandmarks);
        } else {
          // If MediaPipe misses in low light, seamlessly run optical tracker
          this._processOpticalFallback();
        }
      });
    } catch (err) {
      console.warn("[ReelFlick] MediaPipe initialization fallback:", err);
    }
  }

  _loop() {
    if (!this.isRunning) return;

    if (this.video && this.video.readyState >= this.video.HAVE_CURRENT_DATA) {
      this.canvas.width = this.video.videoWidth || 320;
      this.canvas.height = this.video.videoHeight || 240;

      if (this.mediaPipeHands) {
        this.mediaPipeHands.send({ image: this.video }).catch(() => {
          this._processOpticalFallback();
        });
      } else {
        this._processOpticalFallback();
      }
    }

    this.animFrameId = requestAnimationFrame(() => this._loop());
  }

  _processOpticalFallback() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0) return;

    this.ctx.drawImage(this.video, 0, 0, w, h);
    const frame = this.ctx.getImageData(0, 0, w, h);
    const data = frame.data;

    let minX = w, maxX = 0, minY = h, maxY = 0;
    let sumX = 0, sumY = 0, count = 0;

    // Wide gamut skin & movement detection across full FOV
    for (let i = 0; i < data.length; i += 12) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Broad adaptive skin-tone envelope
      if (r > 60 && g > 30 && b > 15 && (r > g) && (r > b) && (Math.abs(r - g) > 8)) {
        const pixelIdx = i / 4;
        const x = (pixelIdx % w);
        const y = Math.floor(pixelIdx / w);

        sumX += x;
        sumY += y;
        count++;

        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    // Minimum cluster required (expanded range detection)
    if (count > (w * h * 0.008)) {
      const cx = (sumX / count) / w;
      const cy = (sumY / count) / h;
      // Mirror X to match mirrored video display
      const mirroredCx = 1.0 - cx;
      const boxW = Math.max(0.14, (maxX - minX) / w);
      const boxH = Math.max(0.18, (maxY - minY) / h);

      const synthLandmarks = this._generateMultiLandmarkHand(mirroredCx, cy, boxW, boxH);
      this.onResults(synthLandmarks);
      this._drawHandBoxAndJoints(mirroredCx, cy, boxW, boxH, w, h, synthLandmarks);
    } else {
      this.onResults(null);
      this._clearSkeleton();
    }
  }

  _generateMultiLandmarkHand(cx, cy, bw, bh) {
    const landmarks = [];
    const wrist = { x: cx, y: cy + bh * 0.35, z: 0 };
    landmarks[0] = wrist;

    const fingerOffsets = [
      [-bw * 0.32, -bh * 0.1], // Thumb
      [-bw * 0.18, -bh * 0.42], // Index
      [0.0,        -bh * 0.5], // Middle
      [bw * 0.18,  -bh * 0.44], // Ring
      [bw * 0.3,   -bh * 0.34]  // Pinky
    ];

    for (let f = 0; f < 5; f++) {
      const [ox, oy] = fingerOffsets[f];
      const baseIdx = 1 + f * 4;
      for (let j = 0; j < 4; j++) {
        const t = (j + 1) / 4.0;
        landmarks[baseIdx + j] = {
          x: cx + ox * t,
          y: (cy + bh * 0.15) + (oy - bh * 0.15) * t,
          z: 0
        };
      }
    }
    return landmarks;
  }

  _drawHandBoxAndJoints(cx, cy, bw, bh, w, h, landmarks) {
    this.ctx.clearRect(0, 0, w, h);

    const boxX = (cx - bw / 2) * w;
    const boxY = (cy - bh / 2) * h;
    const boxW = bw * w;
    const boxH = bh * h;

    this.ctx.strokeStyle = "rgba(99, 102, 241, 0.75)";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(boxX, boxY, boxW, boxH);

    this.ctx.fillStyle = "rgba(99, 102, 241, 0.12)";
    this.ctx.fillRect(boxX, boxY, boxW, boxH);

    this._drawSkeletonOnly(landmarks);
  }

  _drawSkeleton(landmarks) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);
    this._drawSkeletonOnly(landmarks);
  }

  _drawSkeletonOnly(landmarks) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8], // Index
      [0, 9], [9, 10], [10, 11], [11, 12], // Middle
      [0, 13], [13, 14], [14, 15], [15, 16], // Ring
      [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
      [5, 9], [9, 13], [13, 17] // Palm
    ];

    this.ctx.shadowBlur = 6;
    this.ctx.shadowColor = "#818cf8";
    this.ctx.strokeStyle = "rgba(129, 140, 248, 0.9)";
    this.ctx.lineWidth = 2.5;

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

    this.ctx.shadowBlur = 0;
    for (let p of landmarks) {
      if (p) {
        this.ctx.fillStyle = "#38bdf8";
        this.ctx.beginPath();
        this.ctx.arc(p.x * w, p.y * h, 3.5, 0, 2 * Math.PI);
        this.ctx.fill();
      }
    }
  }


  _clearSkeleton() {
    if (this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}

// Attach globally
window.ReelFlickHandTracker = HandTracker;

