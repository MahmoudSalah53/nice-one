// Content script — injects the voice agent on Nice One sites only (niceonesa.com)

const LOG_PREFIX = "[Nice One Extension]";
const NICEONE_URL_PATTERN = /(?:^|\.)niceonesa\.com/i;

(function () {
  if (
    window.location.protocol === "chrome:" ||
    window.location.protocol === "chrome-extension:"
  ) {
    return;
  }

  if (!NICEONE_URL_PATTERN.test(window.location.hostname)) {
    return;
  }

  let iframeWindow = null;
  let domCollectorReady = false;
  let pendingDOMRequest = null;

  function injectPopup() {
    if (document.getElementById("lk-embed-wrapper")) {
      return;
    }

    chrome.storage.sync.get(["enabled", "sandboxId"], (result) => {
      const enabled = result.enabled !== false;
      const sandboxId = result.sandboxId || "http://localhost:3000";

      if (!enabled) {
        return;
      }

      console.log(LOG_PREFIX, "Mode: popup (niceonesa.com)");
      console.log(LOG_PREFIX, "Server URL:", sandboxId);
      injectPopupScript(sandboxId);
    });
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!event.data || !event.data.type) return;

    if (event.data.type === "voice-agent-dom-collector-ready") {
      console.log(LOG_PREFIX, "DOM Collector is ready");
      domCollectorReady = true;
      if (pendingDOMRequest) {
        requestDOMFromCollector();
      }
    }

    if (event.data.type === "voice-agent-dom-result") {
      console.log(
        LOG_PREFIX,
        "DOM received from collector:",
        event.data.data?.nIntr,
        "elements",
      );
      if (iframeWindow) {
        iframeWindow.postMessage(
          {
            type: "lk-dom-data",
            data: event.data.data,
          },
          "*",
        );
        console.log(LOG_PREFIX, "DOM sent to iframe");
      }
    }

    if (event.data.type === "voice-agent-action-result") {
      const { requestId, success, error } = event.data;
      console.log(
        LOG_PREFIX,
        "Action result:",
        success ? "success" : "failed",
        error || "",
      );
      if (iframeWindow) {
        iframeWindow.postMessage(
          {
            type: "lk-action-result",
            requestId,
            success,
            error,
          },
          "*",
        );
      }
    }
  });

  function requestDOMFromCollector() {
    if (domCollectorReady) {
      console.log(LOG_PREFIX, "Requesting DOM from collector...");
      window.postMessage({ type: "voice-agent-collect-dom" }, "*");
    } else {
      console.log(
        LOG_PREFIX,
        "DOM Collector not ready, will request when ready",
      );
      pendingDOMRequest = true;
    }
  }

  function executeActionViaCollector(action, data, requestId) {
    window.postMessage(
      {
        type: "voice-agent-execute-action",
        action,
        data,
        requestId,
      },
      "*",
    );
  }

  function injectIframe(sandboxId) {
    console.log(LOG_PREFIX, "Creating iframe with extension wrapper...");

    injectPageAutomation();

    const wrapper = document.createElement("div");
    wrapper.id = "lk-embed-wrapper";
    let shrinkTimer = null;
    const SHRINK_DELAY_MS = 180;
    wrapper.style.cssText = `
      position: fixed !important;
      bottom: 0px !important;
      right: 16px !important;
      z-index: 2147483647 !important;
      width: 100px !important;
      height: 100px !important;
      border: none !important;
      background: transparent !important;
      pointer-events: auto !important;
    `;

    const iframe = document.createElement("iframe");
    iframe.id = "lk-embed-iframe";

    const wrapperUrl = chrome.runtime.getURL(
      `iframe-wrapper.html?server=${encodeURIComponent(sandboxId)}`,
    );
    iframe.src = wrapperUrl;

    iframe.style.cssText = `
      width: 100% !important;
      height: 100% !important;
      border: none !important;
      background: transparent !important;
      overflow: visible !important;
    `;
    iframe.allow = "microphone *; autoplay *";
    iframe.setAttribute("allowtransparency", "true");

    iframe.onload = () => {
      console.log(LOG_PREFIX, "Extension wrapper iframe loaded");
      iframeWindow = iframe.contentWindow;
    };
    iframe.onerror = (e) => {
      console.error(LOG_PREFIX, "Iframe failed to load:", e);
    };

    wrapper.appendChild(iframe);
    document.body.appendChild(wrapper);
    console.log(LOG_PREFIX, "Wrapper added to body");

    window.addEventListener("message", (event) => {
      if (!event.origin.startsWith("chrome-extension://")) {
        let serverOrigin;
        try {
          serverOrigin = new URL(sandboxId).origin;
        } catch (e) {
          return;
        }
        if (event.origin !== serverOrigin) {
          return;
        }
      }

      if (!event.data || !event.data.type) {
        return;
      }

      const messageType = event.data.type;

      if (messageType === "lk-embed-resize") {
        const { width, height } = event.data;
        if (typeof width === "number" && typeof height === "number") {
          const currentWidth = wrapper.offsetWidth;
          const currentHeight = wrapper.offsetHeight;
          const isShrinking = width < currentWidth || height < currentHeight;
          const applyResize = () => {
            wrapper.style.width = `${width}px`;
            wrapper.style.height = `${height}px`;
          };

          if (shrinkTimer !== null) {
            clearTimeout(shrinkTimer);
            shrinkTimer = null;
          }

          console.log(LOG_PREFIX, "Resizing to:", width, "x", height);

          if (isShrinking) {
            shrinkTimer = setTimeout(() => {
              applyResize();
              shrinkTimer = null;
            }, SHRINK_DELAY_MS);
          } else {
            applyResize();
          }
        }
      }

      if (messageType === "lk-embed-ready") {
        console.log(LOG_PREFIX, "Iframe ready, preparing to send DOM...");
        setTimeout(() => {
          console.log(LOG_PREFIX, "Sending initial DOM...");
          requestDOMFromCollector();
        }, 500);
      }

      if (messageType === "lk-request-dom") {
        console.log(LOG_PREFIX, "DOM requested by iframe");
        requestDOMFromCollector();
      }

      if (messageType === "lk-execute-action") {
        const { action, data, requestId } = event.data;
        console.log(LOG_PREFIX, "Action requested:", action);
        executeActionViaCollector(action, data, requestId);
        setTimeout(requestDOMFromCollector, 500);
      }

      if (messageType === "lk-embed-state") {
        console.log(LOG_PREFIX, "State:", event.data.state);
      }
    });

    console.log(
      LOG_PREFIX,
      "Iframe wrapper injected, loading from:",
      sandboxId,
    );
  }

  function injectPopupScript(sandboxId) {
    if (document.querySelector('script[data-niceone-popup="true"]')) {
      return;
    }

    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("embed-popup.js");
    script.dataset.lkSandboxId = sandboxId;
    script.dataset.niceonePopup = "true";
    script.onload = () => {
      console.log(LOG_PREFIX, "Popup bundle loaded successfully");
    };
    script.onerror = (error) => {
      console.error(LOG_PREFIX, "Popup bundle failed to load:", error);
    };

    (document.head || document.documentElement).appendChild(script);
  }

  function injectPageAutomation() {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("page-automation.js");
    script.onload = () => {
      console.log(LOG_PREFIX, "Page Automation injected");
    };
    script.onerror = () => {
      console.error(LOG_PREFIX, "Failed to inject Page Automation");
    };
    (document.head || document.documentElement).appendChild(script);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectPopup);
  } else {
    injectPopup();
  }
})();
