/**
 * ReelFlick Content Script
 * Assembles Floating HUD, In-Browser Tracker, Gesture Engine, and Platform Adapter.
 */

(function () {
  if (window.__REELFLICK_INITIALIZED__) return;
  window.__REELFLICK_INITIALIZED__ = true;

  console.log("[ReelFlick] Content script initialized on short-form platform.");

  let settings = {
    enabled: true,
    mode: "scroll_only",
    sensitivity: 1.2,
    cooldown: 0.75,
    showHud: true,
    cameraVisible: true,
    autoStart: true,
    minimized: false
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

    // Listen for setting changes from Popup
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
            if (settings.enabled !== false && settings.showHud !== false) {
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

  // 2. Inject Bottom-Right Floating HUD with Dragging & Minimizing
  function createHud() {
    if (document.getElementById("reelflick-hud-root")) return;

    const root = document.createElement("div");
    root.id = "reelflick-hud-root";
    if (settings.showHud === false || settings.enabled === false) {
      root.classList.add("rf-hidden");
    }
    if (settings.minimized) {
      root.classList.add("minimized");
    }

    root.innerHTML = `
      <div class="rf-hud-container" id="rf-container">
        <div class="rf-hud-header" id="rf-header" title="Drag to reposition">
          <div class="rf-brand" id="rf-brand-pill">
            <div class="rf-brand-dot searching" id="rf-status-dot"></div>
            <span class="rf-brand-title">ReelFlick</span>
          </div>
          <div class="rf-header-actions">
            <span class="rf-mode-badge" id="rf-mode-badge" title="Click to toggle gesture mode">
              ${settings.mode === "scroll_only" ? "Scroll" : "Full"}
            </span>
            <button class="rf-mini-btn" id="rf-btn-min" title="Minimize/Expand">_</button>
          </div>
        </div>

        <div class="rf-viewport ${settings.cameraVisible === false ? 'hidden-view' : ''}" id="rf-viewport" title="Live gesture feed">
          <video class="rf-video-stream" id="rf-video" playsinline muted autoplay></video>
          <canvas class="rf-canvas-overlay" id="rf-canvas"></canvas>
          <div class="rf-gesture-feedback" id="rf-feedback">
            <span class="rf-gesture-icon" id="rf-feedback-icon">⚡</span>
            <span class="rf-gesture-text" id="rf-feedback-text">Flick Up</span>
          </div>
        </div>

        <div class="rf-status-bar" id="rf-status-text">Calibrating hand...</div>

        <div class="rf-toolbar">
          <button class="rf-tool-btn" id="rf-btn-view" title="Toggle camera visibility">
            👁️
          </button>
          <button class="rf-tool-btn active" id="rf-btn-toggle" title="Pause/Resume Tracking">
            ⏹ Active
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    // Cache elements
    hudElements = {
      root,
      container: document.getElementById("rf-container"),
      header: document.getElementById("rf-header"),
      brandPill: document.getElementById("rf-brand-pill"),
      statusDot: document.getElementById("rf-status-dot"),
      modeBadge: document.getElementById("rf-mode-badge"),
      viewport: document.getElementById("rf-viewport"),
      video: document.getElementById("rf-video"),
      canvas: document.getElementById("rf-canvas"),
      feedback: document.getElementById("rf-feedback"),
      feedbackIcon: document.getElementById("rf-feedback-icon"),
      feedbackText: document.getElementById("rf-feedback-text"),
      statusText: document.getElementById("rf-status-text"),
      btnMin: document.getElementById("rf-btn-min"),
      btnView: document.getElementById("rf-btn-view"),
      btnToggle: document.getElementById("rf-btn-toggle")
    };

    // Attach HUD listeners
    hudElements.modeBadge.addEventListener("click", toggleMode);
    hudElements.btnToggle.addEventListener("click", toggleTracking);
    hudElements.btnMin.addEventListener("click", toggleMinimize);
    hudElements.brandPill.addEventListener("click", () => {
      if (root.classList.contains("minimized")) toggleMinimize();
    });
    hudElements.btnView.addEventListener("click", toggleCameraVisibility);

    // Enable dragging
    makeDraggable(root, hudElements.header);

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
      hudElements.statusText.textContent = "Wave hand to control...";
      return;
    }

    hudElements.statusDot.className = "rf-brand-dot"; // active green
    hudElements.statusText.textContent = settings.mode === "scroll_only" ? "Scroll ready (Flick ⬆⬇)" : "Hand active (Flicks & 👍)";

    const result = gestureEngine.process(landmarks);

    if (result.action) {
      triggerAction(result.action, result);
    }
  }

  // 4. Trigger Platform Action & Show HUD Feedback
  function triggerAction(action, result) {
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
    }, 650);
  }

  // 5. Controls & Toggles
  async function startTracking() {
    try {
      hudElements.statusDot.className = "rf-brand-dot searching";
      hudElements.statusText.textContent = "Starting camera...";
      hudElements.btnToggle.innerHTML = "⏳ Starting";

      await handTracker.start();

      hudElements.statusDot.className = "rf-brand-dot";
      hudElements.statusText.textContent = settings.mode === "scroll_only" ? "Scroll ready" : "Hand tracking ready";
      hudElements.btnToggle.innerHTML = "⏹ Active";
      hudElements.btnToggle.classList.add("active");
    } catch (err) {
      console.warn("[ReelFlick] startTracking error:", err);
      hudElements.statusDot.className = "rf-brand-dot inactive";
      hudElements.btnToggle.innerHTML = "▶ Start";
      hudElements.btnToggle.classList.remove("active");

      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        hudElements.statusText.textContent = "Allow camera access in URL bar";
      } else {
        hudElements.statusText.textContent = "Click 'Start' to enable camera";
      }
    }
  }

  function stopTracking() {
    try {
      handTracker.stop();
    } catch (e) {}
    hudElements.statusDot.className = "rf-brand-dot inactive";
    hudElements.statusText.textContent = "Tracking paused";
    hudElements.btnToggle.innerHTML = "▶ Start";
    hudElements.btnToggle.classList.remove("active");
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

  function toggleMinimize() {
    settings.minimized = !settings.minimized;
    if (settings.minimized) {
      hudElements.root.classList.add("minimized");
      hudElements.btnMin.textContent = "+";
    } else {
      hudElements.root.classList.remove("minimized");
      hudElements.btnMin.textContent = "_";
    }
    if (chrome?.storage?.sync) {
      chrome.storage.sync.set({ minimized: settings.minimized });
    }
  }

  function toggleCameraVisibility() {
    settings.cameraVisible = !settings.cameraVisible;
    if (settings.cameraVisible) {
      hudElements.viewport.classList.remove("hidden-view");
      hudElements.btnView.style.opacity = "1";
    } else {
      hudElements.viewport.classList.add("hidden-view");
      hudElements.btnView.style.opacity = "0.4";
    }
    if (chrome?.storage?.sync) {
      chrome.storage.sync.set({ cameraVisible: settings.cameraVisible });
    }
  }

  function updateHudUI() {
    if (!hudElements) return;
    hudElements.modeBadge.textContent = settings.mode === "scroll_only" ? "Scroll" : "Full";
  }

  // 6. Make HUD Draggable across the window
  function makeDraggable(element, handle) {
    let isDragging = false;
    let startX = 0, startY = 0;
    let elemStartX = 0, elemStartY = 0;

    handle.addEventListener("mousedown", (e) => {
      if (e.target.closest("button") || e.target.closest(".rf-mode-badge")) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = element.getBoundingClientRect();
      elemStartX = rect.left;
      elemStartY = rect.top;

      // Remove bottom/right pinning for direct pixel positioning
      element.style.bottom = "auto";
      element.style.right = "auto";
      element.style.left = `${elemStartX}px`;
      element.style.top = `${elemStartY}px`;

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      e.preventDefault();
    });

    function onMouseMove(e) {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const newLeft = Math.max(10, Math.min(window.innerWidth - element.offsetWidth - 10, elemStartX + dx));
      const newTop = Math.max(10, Math.min(window.innerHeight - element.offsetHeight - 10, elemStartY + dy));

      element.style.left = `${newLeft}px`;
      element.style.top = `${newTop}px`;
    }

    function onMouseUp() {
      isDragging = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
  }

  // Execute initialization
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
