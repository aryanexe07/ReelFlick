/**
 * ReelFlick Popup Controller
 * Manages extension preferences, tab detection, and embedded Vision Monitor camera preview.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const toggleEnabled = document.getElementById("toggle-enabled");
  const modeScrollOnly = document.getElementById("mode-scroll-only");
  const modeFullGestures = document.getElementById("mode-full-gestures");
  const badgeCurrentMode = document.getElementById("badge-current-mode");
  const sliderSensitivity = document.getElementById("slider-sensitivity");
  const valSensitivity = document.getElementById("val-sensitivity");
  const presetBtns = document.querySelectorAll(".rf-preset-btn");
  const toggleAutostart = document.getElementById("toggle-autostart");
  const toggleHud = document.getElementById("toggle-hud");
  const refLikeItem = document.getElementById("ref-like-item");
  const platformLabel = document.getElementById("platform-label");
  const platformDot = document.getElementById("platform-dot");

  const tagYt = document.getElementById("tag-yt");
  const tagIg = document.getElementById("tag-ig");
  const tagTt = document.getElementById("tag-tt");

  // Popup Vision Monitor elements
  const btnPopupCam = document.getElementById("btn-popup-cam");
  const popupCamBtnText = document.getElementById("popup-cam-btn-text");
  const popupVideo = document.getElementById("popup-video");
  const popupCanvas = document.getElementById("popup-canvas");
  const popupCamStandby = document.getElementById("popup-cam-standby");
  const popupFeedback = document.getElementById("popup-feedback");
  const popupFeedbackIcon = document.getElementById("popup-feedback-icon");
  const popupFeedbackText = document.getElementById("popup-feedback-text");

  let popupTracker = null;
  let popupGestureEngine = null;
  let feedbackTimer = null;

  // 1. Detect Active Tab Platform
  detectCurrentTab();

  function detectCurrentTab() {
    if (!chrome?.tabs?.query) {
      platformLabel.textContent = "Ready for Shorts & Reels";
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]?.url) {
        platformLabel.textContent = "ReelFlick Ready";
        return;
      }

      const url = tabs[0].url.toLowerCase();
      if (url.includes("youtube.com/shorts") || url.includes("youtube.com")) {
        platformLabel.textContent = "Connected: YouTube Shorts";
        platformDot.className = "rf-status-indicator ready";
        tagYt.classList.add("active-platform");
      } else if (url.includes("instagram.com/reels") || url.includes("instagram.com")) {
        platformLabel.textContent = "Connected: Instagram Reels";
        platformDot.className = "rf-status-indicator ready";
        tagIg.classList.add("active-platform");
      } else if (url.includes("tiktok.com")) {
        platformLabel.textContent = "Connected: TikTok";
        platformDot.className = "rf-status-indicator ready";
        tagTt.classList.add("active-platform");
      } else {
        platformLabel.textContent = "Open Shorts, Reels, or TikTok to flick";
        platformDot.className = "rf-status-indicator inactive";
      }
    });
  }

  // 2. Load Saved Settings
  if (chrome?.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (res) => {
      if (res && res.settings) {
        applySettingsToUI(res.settings);
      }
    });
  }

  function applySettingsToUI(s) {
    toggleEnabled.checked = s.enabled !== false;
    const sens = s.sensitivity || 1.2;
    sliderSensitivity.value = sens;
    valSensitivity.textContent = `${parseFloat(sens).toFixed(1)}x`;
    toggleAutostart.checked = s.autoStart !== false;
    if (toggleHud) toggleHud.checked = s.showHud !== false;

    setModeUI(s.mode || "scroll_only");
    updatePresetHighlight(sens);

    if (popupGestureEngine) {
      popupGestureEngine.updateConfig({
        mode: s.mode || "scroll_only",
        sensitivity: sens
      });
    }
  }

  function setModeUI(mode) {
    if (mode === "scroll_only") {
      modeScrollOnly.classList.add("active");
      modeFullGestures.classList.remove("active");
      badgeCurrentMode.textContent = "Air Scroll";
      if (refLikeItem) refLikeItem.style.opacity = "0.35";
    } else {
      modeFullGestures.classList.add("active");
      modeScrollOnly.classList.remove("active");
      badgeCurrentMode.textContent = "Full Mode";
      if (refLikeItem) refLikeItem.style.opacity = "1";
    }
  }

  function updatePresetHighlight(val) {
    presetBtns.forEach((btn) => {
      const pVal = parseFloat(btn.getAttribute("data-val"));
      if (Math.abs(pVal - val) < 0.1) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  // 3. Save & Broadcast Settings
  function saveSettings() {
    const isScrollOnly = modeScrollOnly.classList.contains("active");
    const settings = {
      enabled: toggleEnabled.checked,
      mode: isScrollOnly ? "scroll_only" : "full_gestures",
      sensitivity: parseFloat(sliderSensitivity.value),
      autoStart: toggleAutostart.checked,
      showHud: toggleHud ? toggleHud.checked : true
    };

    if (popupGestureEngine) {
      popupGestureEngine.updateConfig(settings);
    }

    chrome.runtime.sendMessage({
      type: "UPDATE_SETTINGS",
      settings: settings
    });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "SETTINGS_UPDATED",
          settings: settings
        }).catch(() => {});
      }
    });
  }

  // 4. Popup Vision Monitor Camera & Test Logic
  function initPopupCamera() {
    if (!window.ReelFlickGestureEngine || !window.ReelFlickHandTracker) return;

    popupGestureEngine = new window.ReelFlickGestureEngine({
      mode: modeScrollOnly.classList.contains("active") ? "scroll_only" : "full_gestures",
      sensitivity: parseFloat(sliderSensitivity.value)
    });

    popupTracker = new window.ReelFlickHandTracker(popupVideo, popupCanvas, (landmarks) => {
      if (!landmarks) return;
      const res = popupGestureEngine.process(landmarks);
      if (res && res.action) {
        showPopupFeedback(res.action, res.message);
      }
    });
  }

  function showPopupFeedback(action, text) {
    let svgIcon = "";
    if (action === "NEXT") {
      svgIcon = `<svg class="rf-svg-icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`;
      text = "Next Video";
    } else if (action === "PREVIOUS") {
      svgIcon = `<svg class="rf-svg-icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>`;
      text = "Previous Video";
    } else if (action === "LIKE") {
      svgIcon = `<svg class="rf-svg-icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>`;
      text = "Liked!";
    }

    popupFeedbackIcon.innerHTML = svgIcon;
    popupFeedbackText.textContent = text;
    popupFeedback.classList.add("show");

    if (feedbackTimer) clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      popupFeedback.classList.remove("show");
    }, 650);
  }

  async function togglePopupCamera() {
    if (!popupTracker) initPopupCamera();
    if (!popupTracker) return;

    if (popupTracker.isRunning) {
      popupTracker.stop();
      btnPopupCam.classList.remove("active");
      popupCamBtnText.textContent = "Test Camera";
      popupCamStandby.classList.remove("hidden");
    } else {
      try {
        popupCamBtnText.textContent = "Starting...";
        await popupTracker.start();
        btnPopupCam.classList.add("active");
        popupCamBtnText.textContent = "Stop Monitor";
        popupCamStandby.classList.add("hidden");
      } catch (e) {
        popupCamBtnText.textContent = "Test Camera";
        btnPopupCam.classList.remove("active");
      }
    }
  }

  btnPopupCam.addEventListener("click", togglePopupCamera);

  // Clean up camera when popup unloads
  window.addEventListener("unload", () => {
    if (popupTracker && popupTracker.isRunning) {
      popupTracker.stop();
    }
  });

  // 5. General Event Listeners
  toggleEnabled.addEventListener("change", saveSettings);
  toggleAutostart.addEventListener("change", saveSettings);
  if (toggleHud) toggleHud.addEventListener("change", saveSettings);

  modeScrollOnly.addEventListener("click", () => {
    setModeUI("scroll_only");
    saveSettings();
  });

  modeFullGestures.addEventListener("click", () => {
    setModeUI("full_gestures");
    saveSettings();
  });

  sliderSensitivity.addEventListener("input", (e) => {
    valSensitivity.textContent = `${parseFloat(e.target.value).toFixed(1)}x`;
    updatePresetHighlight(parseFloat(e.target.value));
  });

  sliderSensitivity.addEventListener("change", saveSettings);

  presetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = parseFloat(btn.getAttribute("data-val"));
      sliderSensitivity.value = val;
      valSensitivity.textContent = `${val.toFixed(1)}x`;
      updatePresetHighlight(val);
      saveSettings();
    });
  });
});
