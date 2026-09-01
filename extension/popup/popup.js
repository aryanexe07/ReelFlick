/**
 * ReelFlick Popup Controller
 * Manages extension preferences, tab status detection, and real-time settings broadcast.
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
      badgeCurrentMode.textContent = "Full Hands-Free";
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

    // Save to runtime storage
    chrome.runtime.sendMessage({
      type: "UPDATE_SETTINGS",
      settings: settings
    });

    // Broadcast directly to active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "SETTINGS_UPDATED",
          settings: settings
        }).catch(() => {});
      }
    });
  }

  // 4. Event Listeners
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
