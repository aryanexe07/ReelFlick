/**
 * ReelFlick Content Script
 * Assembles Floating HUD, In-Browser Tracker, Gesture Engine, and Platform Adapter.
 */

(function () {
  if (window.__REELFLICK_INITIALIZED__) return;
  window.__REELFLICK_INITIALIZED__ = true;

  console.log("[ReelFlick] Content script injected.");

  let settings = {
    enabled: true,
    mode: "scroll_only",
    sensitivity: 1.2,
    cooldown: 0.8,
    showHud: true,
    hudSize: "compact",
    cameraVisible: true,
    autoStart: true
  };

  let platformAdapter = null;
  let gestureEngine = null;
  let handTracker = null;
  let hudElements = null;
  let feedbackTimeout = null;

  // 1. Initialize Components
  function init() {
    platformAdapter = new window.ReelFlickPlatformAdapter();
    gestureEngine = new window.ReelFlickGestureEngine(settings);

    // Fetch initial settings from Chrome Storage
    if (chrome?.storage?.sync) {
      chrome.storage.sync.get(settings, (stored) => {
        settings = Object.assign(settings, stored);
        gestureEngine.updateConfig(settings);
        createHud();
        if (settings.enabled && settings.autoStart) {
          startTracking();
        }
      });
    } else {
      createHud();
      startTracking();
    }

    // Listen for setting changes
    if (chrome?.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === "SETTINGS_UPDATED") {
          const oldEnabled = settings.enabled;
          settings = Object.assign(settings, msg.settings);
          gestureEngine.updateConfig(settings);

          // If extension was switched off, shut camera off immediately
          if (oldEnabled && !settings.enabled) {
            stopTracking();
          } else if (!oldEnabled && settings.enabled && settings.autoStart) {
            startTracking();
          }

          // Handle HUD visibility
          if (hudElements?.root) {
            if (settings.enabled !== false) {
              hudElements.root.classList.remove("rf-hidden");
            } else {
              hudElements.root.classList.add("rf-hidden");
            }
          }

          updateHudUI();
        }
      });
    }
  }


  // 2. Inject Bottom-Right Floating HUD
  function createHud() {
    if (document.getElementById("reelflick-hud-root")) return;

    const root = document.createElement("div");
    root.id = "reelflick-hud-root";
    if (settings.showHud === false || settings.enabled === false) {
      root.classList.add("rf-hidden");
    }


    root.innerHTML = `
      <div class="rf-hud-container" id="rf-container">
        <div class="rf-hud-header" id="rf-header">
          <div class="rf-brand">
            <div class="rf-brand-dot searching" id="rf-status-dot"></div>
            <span class="rf-brand-title">ReelFlick</span>
          </div>
          <div class="rf-header-actions">
            <span class="rf-mode-badge" id="rf-mode-badge">${settings.mode === "scroll_only" ? "Scroll Only" : "Full Gestures"}</span>
          </div>
        </div>

        <div class="rf-viewport" id="rf-viewport" title="Click to start/pause camera">
          <video class="rf-video-stream" id="rf-video" playsinline muted autoplay></video>
          <canvas class="rf-canvas-overlay" id="rf-canvas"></canvas>
          <div class="rf-gesture-feedback" id="rf-feedback">
            <span class="rf-gesture-icon" id="rf-feedback-icon">⚡</span>
            <span class="rf-gesture-text" id="rf-feedback-text">Flick Up</span>
          </div>
        </div>

        <div class="rf-status-bar" id="rf-status-text">Calibrating hand...</div>

        <div class="rf-toolbar">
          <button class="rf-tool-btn ${settings.mode === 'scroll_only' ? 'active' : ''}" id="rf-btn-mode" title="Toggle Scroll-Only / Full Gesture Mode">
            ⚡ <span>${settings.mode === 'scroll_only' ? 'Scroll' : 'Full'}</span>
          </button>
          <button class="rf-tool-btn" id="rf-btn-toggle" title="Pause/Resume Tracking">
            ⏹ Pause
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    // Cache elements
    hudElements = {
      root,
      container: document.getElementById("rf-container"),
      statusDot: document.getElementById("rf-status-dot"),
      modeBadge: document.getElementById("rf-mode-badge"),
      viewport: document.getElementById("rf-viewport"),
      video: document.getElementById("rf-video"),
      canvas: document.getElementById("rf-canvas"),
      feedback: document.getElementById("rf-feedback"),
      feedbackIcon: document.getElementById("rf-feedback-icon"),
      feedbackText: document.getElementById("rf-feedback-text"),
      statusText: document.getElementById("rf-status-text"),
      btnMode: document.getElementById("rf-btn-mode"),
      btnToggle: document.getElementById("rf-btn-toggle")
    };

    // Attach HUD listeners
    hudElements.btnMode.addEventListener("click", toggleMode);
    hudElements.btnToggle.addEventListener("click", toggleTracking);

    // Initialize Hand Tracker
    handTracker = new window.ReelFlickHandTracker(
      hudElements.video,
      hudElements.canvas,
      onHandResults
    );
  }


  // 3. Process Gestures from Tracker
  function onHandResults(landmarks) {
    if (!settings.enabled) return;

    if (!landmarks) {
      hudElements.statusDot.className = "rf-brand-dot searching";
      if (hudElements.statusDotPill) hudElements.statusDotPill.className = "rf-brand-dot searching";
      hudElements.statusText.textContent = "Wave hand to control...";
      return;
    }

    hudElements.statusDot.className = "rf-brand-dot"; // green active
    if (hudElements.statusDotPill) hudElements.statusDotPill.className = "rf-brand-dot";
    hudElements.statusText.textContent = settings.mode === "scroll_only" ? "Scroll gesture ready" : "Hand detected";

    const result = gestureEngine.process(landmarks);

    if (result.action) {
      triggerAction(result.action, result);
    }
  }


  // 4. Trigger Platform Action & Show HUD Feedback
  function triggerAction(action, result) {
    console.log("[ReelFlick] Action Triggered:", action, result);

    let icon = "⚡";
    let text = result.message || action;

    switch (action) {
      case "NEXT":
        platformAdapter.next();
        icon = "⬇️";
        text = "Next Video";
        break;
      case "PREVIOUS":
        platformAdapter.previous();
        icon = "⬆️";
        text = "Previous Video";
        break;
      case "LIKE":
        platformAdapter.like();
        icon = "❤️";
        text = "Liked!";
        break;
      case "PLAY_PAUSE":
        platformAdapter.togglePlayPause();
        icon = "⏯️";
        text = "Play/Pause";
        break;
    }

    showGestureFeedback(icon, text);
  }

  function showGestureFeedback(icon, text) {
    if (!hudElements.feedback) return;
    hudElements.feedbackIcon.textContent = icon;
    hudElements.feedbackText.textContent = text;
    hudElements.feedback.classList.add("show");

    if (feedbackTimeout) clearTimeout(feedbackTimeout);
    feedbackTimeout = setTimeout(() => {
      hudElements.feedback.classList.remove("show");
    }, 600);
  }

  // 5. Controls & Toggles
  async function startTracking() {
    try {
      hudElements.statusDot.className = "rf-brand-dot searching";
      hudElements.statusText.textContent = "Starting camera...";
      hudElements.btnToggle.innerHTML = "⏳";
      
      await handTracker.start();
      
      hudElements.statusDot.className = "rf-brand-dot";
      hudElements.statusText.textContent = settings.mode === "scroll_only" ? "Scroll gesture ready" : "Hand detected";
      hudElements.btnToggle.innerHTML = "⏹";
      hudElements.btnToggle.title = "Pause Tracking";
    } catch (err) {
      console.warn("[ReelFlick] startTracking error:", err);
      hudElements.statusDot.className = "rf-brand-dot inactive";
      hudElements.btnToggle.innerHTML = "▶";
      hudElements.btnToggle.title = "Click to Start Tracking";
      
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        hudElements.statusText.textContent = "Click icon in URL bar to Allow Cam";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        hudElements.statusText.textContent = "Camera in use by desktop app";
      } else {
        hudElements.statusText.textContent = "Click here to allow camera";
      }
    }
  }

  function stopTracking() {
    try {
      handTracker.stop();
    } catch (e) {}
    hudElements.statusDot.className = "rf-brand-dot inactive";
    hudElements.statusText.textContent = "Tracking paused";
    hudElements.btnToggle.innerHTML = "▶";
    hudElements.btnToggle.title = "Start Tracking";
  }

  function toggleTracking() {
    if (handTracker && handTracker.isRunning) {
      stopTracking();
    } else {
      startTracking();
    }
  }

  function toggleMode() {
    const newMode = settings.mode === "scroll_only" ? "full_gestures" : "scroll_only";
    settings.mode = newMode;
    gestureEngine.updateConfig({ mode: newMode });
    if (chrome?.storage?.sync) {
      chrome.storage.sync.set({ mode: newMode });
    }
    updateHudUI();
  }





  function updateHudUI() {
    if (!hudElements) return;
    hudElements.modeBadge.textContent = settings.mode === "scroll_only" ? "Scroll Only" : "Full Gestures";
    hudElements.btnMode.querySelector("span").textContent = settings.mode === "scroll_only" ? "Scroll" : "Full";
    if (settings.mode === "scroll_only") {
      hudElements.btnMode.classList.add("active");
    } else {
      hudElements.btnMode.classList.remove("active");
    }
  }

  // Execute initialization when document is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
