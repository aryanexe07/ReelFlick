/**
 * ReelFlick Background Service Worker
 * Handles persistent state, tab communications, and default configurations.
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  mode: "scroll_only", // "scroll_only" or "full_gestures"
  sensitivity: 1.2, // 0.6 to 2.4
  cooldown: 0.75, // seconds between triggers
  showHud: true,
  cameraVisible: true,
  autoStart: true,
  minimized: false
};

// Initialize settings on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
    chrome.storage.sync.set(stored);
    console.log("[ReelFlick] Extension installed. Initial settings:", stored);
  });
});

// Relay messages between popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_SETTINGS") {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      sendResponse({ status: "ok", settings });
    });
    return true;
  }

  if (message.type === "UPDATE_SETTINGS") {
    chrome.storage.sync.set(message.settings, () => {
      // Notify all tabs matching supported hosts
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id && tab.url && (tab.url.includes("youtube.com") || tab.url.includes("instagram.com") || tab.url.includes("tiktok.com"))) {
            chrome.tabs.sendMessage(tab.id, {
              type: "SETTINGS_UPDATED",
              settings: message.settings
            }).catch(() => {});
          }
        });
      });
      sendResponse({ status: "ok" });
    });
    return true;
  }
});
