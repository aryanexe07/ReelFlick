/**
 * ReelFlick Platform Adapter
 * Provides direct DOM controls and keyboard event emulation for YouTube Shorts,
 * Instagram Reels, and TikTok with zero lag and native responsiveness.
 */

class PlatformAdapter {
  constructor() {
    this.platform = this.detectPlatform();
    console.log(`[ReelFlick] Detected platform: ${this.platform}`);
  }

  detectPlatform() {
    const host = window.location.hostname;
    if (host.includes("youtube.com")) return "youtube";
    if (host.includes("instagram.com")) return "instagram";
    if (host.includes("tiktok.com")) return "tiktok";
    return "generic";
  }

  /**
   * Navigate to next short/reel
   */
  next() {
    console.log("[ReelFlick] Action: NEXT");
    switch (this.platform) {
      case "youtube":
        this._youtubeNext();
        break;
      case "instagram":
        this._instagramNext();
        break;
      case "tiktok":
        this._tiktokNext();
        break;
      default:
        this._genericNext();
    }
  }

  /**
   * Navigate to previous short/reel
   */
  previous() {
    console.log("[ReelFlick] Action: PREVIOUS");
    switch (this.platform) {
      case "youtube":
        this._youtubePrev();
        break;
      case "instagram":
        this._instagramPrev();
        break;
      case "tiktok":
        this._tiktokPrev();
        break;
      default:
        this._genericPrev();
    }
  }

  /**
   * Continuous or micro-scroll emulation for precision air scroll
   */
  scroll(deltaY) {
    window.scrollBy({
      top: deltaY,
      behavior: "smooth"
    });
  }

  /**
   * Like current video
   */
  like() {
    console.log("[ReelFlick] Action: LIKE");
    switch (this.platform) {
      case "youtube":
        this._youtubeLike();
        break;
      case "instagram":
        this._instagramLike();
        break;
      case "tiktok":
        this._tiktokLike();
        break;
      default:
        this._dispatchKey("l");
    }
  }

  /**
   * Toggle Play / Pause
   */
  togglePlayPause() {
    console.log("[ReelFlick] Action: PLAY/PAUSE");
    switch (this.platform) {
      case "youtube":
      case "instagram":
      case "tiktok":
      default:
        this._dispatchKey(" ");
    }
  }

  // --- YouTube Shorts Implementation ---

  _youtubeNext() {
    // 1. Try finding and clicking Next button
    const downBtn = document.querySelector("#navigation-button-down button") ||
                    document.querySelector("ytd-shorts [aria-label='Next video']") ||
                    document.querySelector("[aria-label='Next video']") ||
                    document.querySelector("#shorts-container #navigation-button-down");
    if (downBtn) {
      downBtn.click();
    }
    
    // 2. Dispatch keyboard 'j' and Down Arrow to active player / container
    this._dispatchKey("j", 74);
    this._dispatchKey("ArrowDown", 40);

    // 3. Emulate mouse wheel scroll on container
    const shortsContainer = document.querySelector("ytd-shorts") || 
                            document.querySelector("#shorts-container") || 
                            document.querySelector("#shorts-inner-container") || 
                            document.body;
    this._simulateWheelOn(shortsContainer, window.innerHeight * 0.9);
  }

  _youtubePrev() {
    const upBtn = document.querySelector("#navigation-button-up button") ||
                  document.querySelector("ytd-shorts [aria-label='Previous video']") ||
                  document.querySelector("[aria-label='Previous video']") ||
                  document.querySelector("#shorts-container #navigation-button-up");
    if (upBtn) {
      upBtn.click();
    }
    
    this._dispatchKey("k", 75);
    this._dispatchKey("ArrowUp", 38);

    const shortsContainer = document.querySelector("ytd-shorts") || 
                            document.querySelector("#shorts-container") || 
                            document.querySelector("#shorts-inner-container") || 
                            document.body;
    this._simulateWheelOn(shortsContainer, -window.innerHeight * 0.9);
  }

  _youtubeLike() {
    const likeBtn = document.querySelector("ytd-shorts ytd-like-button-renderer button") ||
                    document.querySelector("ytd-shorts [aria-label*='like this video' i]") ||
                    document.querySelector("#like-button button") ||
                    document.querySelector("ytd-like-button-renderer button");
    if (likeBtn) {
      likeBtn.click();
    } else {
      this._dispatchKey("l", 76);
    }
  }

  // --- Instagram Reels Implementation ---

  _instagramNext() {
    const nextBtn = document.querySelector("[aria-label='Next']") ||
                    document.querySelector("svg[aria-label='Down chevron']")?.closest("button") ||
                    document.querySelector("svg[aria-label='Down arrow']")?.closest("button");
    if (nextBtn) {
      nextBtn.click();
    }
    this._dispatchKey("ArrowDown", 40);
    this._simulateWheel(window.innerHeight * 0.85);
  }

  _instagramPrev() {
    const prevBtn = document.querySelector("[aria-label='Previous']") ||
                    document.querySelector("svg[aria-label='Up chevron']")?.closest("button") ||
                    document.querySelector("svg[aria-label='Up arrow']")?.closest("button");
    if (prevBtn) {
      prevBtn.click();
    }
    this._dispatchKey("ArrowUp", 38);
    this._simulateWheel(-window.innerHeight * 0.85);
  }

  _instagramLike() {
    const heartBtn = document.querySelector("svg[aria-label='Like']")?.closest("button") ||
                     document.querySelector("section main svg[aria-label='Like']")?.closest("div[role='button']") ||
                     document.querySelector("span[role='button'] svg[aria-label='Like']")?.closest("span");
    if (heartBtn) {
      heartBtn.click();
    } else {
      this._dispatchKey("l", 76);
    }
  }

  // --- TikTok Implementation ---

  _tiktokNext() {
    const downArrow = document.querySelector("[data-e2e='arrow-right']") ||
                      document.querySelector("button[aria-label='Go to next video']") ||
                      document.querySelector("button[aria-label='Next video']");
    if (downArrow) {
      downArrow.click();
    }
    this._dispatchKey("ArrowDown", 40);
    this._simulateWheel(window.innerHeight * 0.85);
  }

  _tiktokPrev() {
    const upArrow = document.querySelector("[data-e2e='arrow-left']") ||
                    document.querySelector("button[aria-label='Go to previous video']") ||
                    document.querySelector("button[aria-label='Previous video']");
    if (upArrow) {
      upArrow.click();
    }
    this._dispatchKey("ArrowUp", 38);
    this._simulateWheel(-window.innerHeight * 0.85);
  }

  _tiktokLike() {
    const likeBtn = document.querySelector("[data-e2e='like-icon']")?.closest("button") ||
                    document.querySelector("span[data-e2e='like-icon']");
    if (likeBtn) {
      likeBtn.click();
    } else {
      this._dispatchKey("l", 76);
    }
  }

  // --- Generic Helpers ---

  _genericNext() {
    this._dispatchKey("ArrowDown", 40);
    this._simulateWheel(window.innerHeight * 0.85);
  }

  _genericPrev() {
    this._dispatchKey("ArrowUp", 38);
    this._simulateWheel(-window.innerHeight * 0.85);
  }

  _dispatchKey(key, keyCode = 0) {
    const targets = [
      document.activeElement,
      document.querySelector("ytd-shorts"),
      document.querySelector("#shorts-player"),
      document.querySelector("video"),
      document.body,
      window
    ].filter(Boolean);

    const opts = {
      key: key,
      code: key === " " ? "Space" : (key.length === 1 ? `Key${key.toUpperCase()}` : key),
      keyCode: keyCode,
      which: keyCode,
      bubbles: true,
      composed: true,
      cancelable: true,
      view: window
    };

    targets.forEach((target) => {
      try {
        target.dispatchEvent(new KeyboardEvent("keydown", opts));
        target.dispatchEvent(new KeyboardEvent("keypress", opts));
        target.dispatchEvent(new KeyboardEvent("keyup", opts));
      } catch (e) {}
    });
  }

  _simulateWheel(deltaY) {
    const scrollTarget = document.querySelector("ytd-shorts") || 
                         document.querySelector("#shorts-container") || 
                         document.querySelector("main") || 
                         document.body;
    this._simulateWheelOn(scrollTarget, deltaY);
  }

  _simulateWheelOn(target, deltaY) {
    if (!target) return;
    const event = new WheelEvent("wheel", {
      deltaY: deltaY,
      deltaMode: 0,
      bubbles: true,
      composed: true,
      cancelable: true
    });
    target.dispatchEvent(event);
    window.scrollBy({ top: deltaY, behavior: "smooth" });
  }
}

// Attach globally
window.ReelFlickPlatformAdapter = PlatformAdapter;

