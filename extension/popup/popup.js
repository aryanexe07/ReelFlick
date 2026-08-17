/**
 * ReelFlick Popup Logic
 */

document.addEventListener("DOMContentLoaded", () => {
  const toggleEnabled = document.getElementById("toggle-enabled");
  const modeScrollOnly = document.getElementById("mode-scroll-only");
  const modeFullGestures = document.getElementById("mode-full-gestures");
  const sliderSensitivity = document.getElementById("slider-sensitivity");
  const valSensitivity = document.getElementById("val-sensitivity");
  const toggleAutostart = document.getElementById("toggle-autostart");
  const refThumbsUp = document.getElementById("ref-thumbsup");

  // Load saved settings
  chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (res) => {
    if (res && res.settings) {
      const s = res.settings;
      toggleEnabled.checked = s.enabled !== false;
      sliderSensitivity.value = s.sensitivity || 1.2;
      valSensitivity.textContent = `${sliderSensitivity.value}x`;
      toggleAutostart.checked = s.autoStart !== false;
      setModeUI(s.mode || "scroll_only");
    }
  });

  function setModeUI(mode) {
    if (mode === "scroll_only") {
      modeScrollOnly.classList.add("active");
      modeFullGestures.classList.remove("active");
      refThumbsUp.style.opacity = "0.4";
    } else {
      modeFullGestures.classList.add("active");
      modeScrollOnly.classList.remove("active");
      refThumbsUp.style.opacity = "1";
    }
  }

  function saveSettings() {
    const settings = {
      enabled: toggleEnabled.checked,
      mode: modeScrollOnly.classList.contains("active") ? "scroll_only" : "full_gestures",
      sensitivity: parseFloat(sliderSensitivity.value),
      autoStart: toggleAutostart.checked
    };

    chrome.runtime.sendMessage({
      type: "UPDATE_SETTINGS",
      settings: settings
    });

    // Also send directly to active tab for immediate responsiveness
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "SETTINGS_UPDATED",
          settings: settings
        }).catch(() => {});
      }
    });
  }

  // Event Listeners
  toggleEnabled.addEventListener("change", saveSettings);
  toggleAutostart.addEventListener("change", saveSettings);


  modeScrollOnly.addEventListener("click", () => {
    setModeUI("scroll_only");
    saveSettings();
  });

  modeFullGestures.addEventListener("click", () => {
    setModeUI("full_gestures");
    saveSettings();
  });

  sliderSensitivity.addEventListener("input", (e) => {
    valSensitivity.textContent = `${e.target.value}x`;
  });

  sliderSensitivity.addEventListener("change", saveSettings);
});
