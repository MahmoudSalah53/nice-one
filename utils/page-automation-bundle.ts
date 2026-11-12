/**
 * Page Automation Bundle
 * Unified DOM collection and action execution for iframe mode
 * Uses the same utils (interactiveDomSerializer, siteAutomation, changeDetection, regenAndDiff) as popup mode
 *
 * This file serves TWO purposes:
 * 1. As a standalone script tag with data-lk-sandbox-id → Creates iframe + DOM collection
 * 2. Injected by chrome extension → DOM collection only (extension creates iframe)
 */

import serializerInstance, {
  DOMElementsJSON,
} from "./interactiveDomSerializer";
import SiteAutomation from "./siteAutomation";
import {
  selectStations,
  setTripTypeAndDateISO,
  setPassengers,
} from "./custom";
import {
  setChangeDetectionCallback,
  initializeChangeDetection,
} from "./changeDetection";
import {
  setAddedOrRemovedCallback, // ⚠️ CHANGED: Was setAddedOrRemovedCallback, now maps to setDOMChangeCallback
  setUrlChangeCallback,
  collectDOMSnapshot,
  // ⚠️ REMOVED: initializeRegenAndDiffMutationObserver - no longer exists
  // The new regenAndDiff auto-initializes via detector.initialize()
} from "./regenAndDiff";

// ===== Check if running as script tag (has data-lk-sandbox-id) =====
const scriptTag = document.querySelector<HTMLScriptElement>(
  "script[data-lk-sandbox-id]",
);
const sandboxIdAttribute = scriptTag?.dataset.lkSandboxId;
const isScriptTagMode = !!sandboxIdAttribute;

// ===== State Management =====
let lastDOMSnapshot: DOMElementsJSON | null = null;
let iframeWindow: Window | null = null;

// ===== DOM Collection (using interactiveDomSerializer) =====
function collectDOM(): DOMElementsJSON {
  return collectDOMSnapshot();
}

// ===== Action Execution (using siteAutomation) =====
interface ActionResult {
  success: boolean;
  error?: string;
}

function executeAction(
  action: string,
  data: Record<string, unknown>,
): ActionResult {
  try {
    switch (action) {
      case "click_button": {
        const jsId = data.jsId as string;
        const success = SiteAutomation.click_button(jsId);
        if (success) return { success: true };
        const lastErr = (
          SiteAutomation as unknown as { lastError?: string }
        ).lastError;
        return {
          success: false,
          error:
            lastErr === "Button is disabled"
              ? "Button is disabled"
              : "Element not found",
        };
      }

      case "refresh_store": {
        const win = window as unknown as {
          __niceoneRefreshStore?: () => void;
        };
        if (typeof win.__niceoneRefreshStore === "function") {
          win.__niceoneRefreshStore();
        }
        return { success: true };
      }

      case "fill_input": {
        const success = SiteAutomation.fill_input(
          data.jsId as string,
          (data.value as string) || "",
        );
        return { success, error: success ? undefined : "Element not found" };
      }

      case "select_option": {
        const success = SiteAutomation.select_option(
          data.jsId as string,
          (data.optionText as string) || (data.optionValue as string) || "",
        );
        return { success, error: success ? undefined : "Option not found" };
      }

      case "set_checkbox": {
        const success = SiteAutomation.set_checkbox(
          data.jsId as string,
          data.checked as boolean | undefined,
        );
        return { success, error: success ? undefined : "Element not found" };
      }

      case "set_radio": {
        const success = SiteAutomation.set_radio(
          data.jsId as string,
          data.value as string | undefined,
        );
        return { success, error: success ? undefined : "Element not found" };
      }

      case "navigate": {
        if (data.url) {
          const success = SiteAutomation.navigate(data.url as string);
          return { success, error: success ? undefined : "Navigation failed" };
        }
        return { success: false, error: "No URL provided" };
      }

      case "open_mat_select": {
        const success = SiteAutomation.open_mat_select(data.jsId as string);
        return { success, error: success ? undefined : "Element not found" };
      }

      case "select_mat_option": {
        // Try by jsId first
        if (data.jsId) {
          const success = SiteAutomation.select_mat_option(data.jsId as string);
          if (success) return { success: true };
        }

        // Fallback: find mat-option by text
        if (data.optionText) {
          const options = document.querySelectorAll("mat-option");
          for (const opt of Array.from(options)) {
            if ((opt as HTMLElement).textContent?.trim() === data.optionText) {
              (opt as HTMLElement).click();
              return { success: true };
            }
          }
        }
        return { success: false, error: "Mat-option not found" };
      }

      case "add_to_cart": {
        if (typeof SiteAutomation.add_to_cart !== "function") {
          return { success: false, error: "add_to_cart not available" };
        }
        const qty = (data.quantity as string) ?? "1";
        const warrantyIdx =
          typeof data.warranty_index === "number" ? data.warranty_index : -1;
        const success = SiteAutomation.add_to_cart(qty, warrantyIdx);
        return { success, error: success ? undefined : "add_to_cart failed" };
      }

      case "checkout": {
        if (typeof SiteAutomation.checkout !== "function") {
          return { success: false, error: "checkout not available" };
        }
        const country = data.country as string;
        const phoneOrEmail = data.phoneOrEmail as string;
        if (!country || typeof country !== "string") {
          return { success: false, error: "country required" };
        }
        if (!phoneOrEmail || typeof phoneOrEmail !== "string") {
          return { success: false, error: "phoneOrEmail (phone_number or email) required" };
        }
        const success = SiteAutomation.checkout(
          country.trim(),
          phoneOrEmail.trim(),
        );
        return { success, error: success ? undefined : "checkout failed" };
      }

      case "select_stations": {
        const departureName = data.departureName as string;
        const arrivalName = data.arrivalName as string;
        if (!departureName || !arrivalName) {
          return {
            success: false,
            error: "departureName and arrivalName required",
          };
        }
        const ok = selectStations(departureName, arrivalName);
        return {
          success: ok,
          error: ok ? undefined : "select_stations failed",
        };
      }

      case "set_trip_type_and_date": {
        const tripType = data.tripType as string;
        const departureDateISO = data.departureDateISO as string;
        const returnDateISO = data.returnDateISO as string | undefined;
        if (!tripType || !departureDateISO) {
          return {
            success: false,
            error: "tripType and departureDateISO required",
          };
        }
        const ok = setTripTypeAndDateISO(
          tripType,
          departureDateISO,
          returnDateISO,
        );
        return {
          success: ok,
          error: ok ? undefined : "set_trip_type_and_date failed",
        };
      }

      case "set_passengers": {
        const adults = typeof data.adults === "number" ? data.adults : 0;
        const children = typeof data.children === "number" ? data.children : 0;
        const infants = typeof data.infants === "number" ? data.infants : 0;
        const ok = setPassengers(
          Math.max(1, adults),
          Math.max(0, children),
          Math.max(0, infants),
        );
        return {
          success: ok,
          error: ok ? undefined : "set_passengers failed",
        };
      }

      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ===== Send DOM to Content Script =====
function sendDOM(domData: DOMElementsJSON): void {
  window.postMessage(
    {
      type: "voice-agent-dom-result",
      data: domData,
    },
    "*",
  );
  console.log("[Page Automation] DOM sent:", domData.nIntr, "elements");
}

// ===== Callback Functions for changeDetection and regenAndDiff =====
// These callbacks send postMessage instead of RPC (since we're in iframe mode)

function handleChangeDetection(data: {
  jsid: string;
  tag: string;
  type?: string | null;
  eventType: "click" | "change";
  value?: string | null;
  checked?: boolean | null;
  selectedOption?: string | null;
}): void {
  // Forward change detection events to content script
  window.postMessage(
    {
      type: "voice-agent-element-changed",
      data,
    },
    "*",
  );

  // Also send updated DOM after a short delay
  setTimeout(() => {
    const newDOM = collectDOM();
    lastDOMSnapshot = newDOM;
    sendDOM(newDOM);
  }, 200);
}

// ⚠️ CHANGED: This now handles BOTH added/removed AND general DOM changes
// The new regenAndDiff only has setDOMChangeCallback (not separate setAddedOrRemovedCallback)
function handleDOMChange(): void {
  // Send full DOM when elements change (added/removed/updated)
  console.log("[Page Automation] DOM changed, sending full DOM...");
  const newDOM = collectDOM();
  lastDOMSnapshot = newDOM;
  sendDOM(newDOM);
}

function handleUrlChange(): void {
  // Send full DOM when URL changes
  console.log("[Page Automation] URL changed, sending full DOM...");
  const newDOM = collectDOM();
  lastDOMSnapshot = newDOM;
  sendDOM(newDOM);
}

// ===== Message Handler =====
function handleMessage(event: MessageEvent): void {
  if (event.source !== window) return;
  if (!event.data || !event.data.type) return;

  // Handle DOM collection request
  if (event.data.type === "voice-agent-collect-dom") {
    console.log("[Page Automation] Collecting DOM...");
    const domData = collectDOM();
    lastDOMSnapshot = domData;
    sendDOM(domData);
  }

  // Handle action execution request
  if (event.data.type === "voice-agent-execute-action") {
    const { action, data, requestId } = event.data;
    console.log("[Page Automation] Executing action:", action);
    const result = executeAction(action, data);
    window.postMessage(
      {
        type: "voice-agent-action-result",
        requestId,
        ...result,
      },
      "*",
    );
  }
}

// ⚠️ NOTE: MutationObserver and Navigation Detection are now AUTO-INITIALIZED
// by regenAndDiff.ts via detector.initialize() - no manual call needed!

// ===== Expose Globals (for debugging) =====
declare global {
  interface Window {
    __voiceAgentPageAutomation: {
      collectDOM: typeof collectDOM;
      executeAction: typeof executeAction;
    };
  }
}

window.__voiceAgentPageAutomation = {
  collectDOM,
  executeAction,
};

// ===== Iframe Creation (for script tag mode) =====
function createIframeEmbed(): void {
  if (!sandboxIdAttribute) return;

  // Check if already injected
  if (document.getElementById("lk-iframe-embed-wrapper")) {
    console.warn(
      "[Page Automation] Wrapper already exists, skipping iframe creation",
    );
    return;
  }

  console.log("[Page Automation] Creating iframe embed...");

  // Create wrapper div - anchored at bottom-right corner so inner .svw-fab at right:16px/bottom:16px matches viewport
  const wrapper = document.createElement("div");
  wrapper.id = "lk-iframe-embed-wrapper";
  let shrinkTimer: number | null = null;
  const SHRINK_DELAY_MS = 600;
  wrapper.style.cssText = `
    position: fixed !important;
    bottom: 0px !important;
    right: 0px !important;
    z-index: 2147483647 !important;
    width: 104px !important;
    height: 104px !important;
    border: none !important;
    background: transparent !important;
    pointer-events: auto !important;  /* ⚠️ عادي - بيستقبل clicks */
  `;

  // Create iframe
  const iframe = document.createElement("iframe");
  iframe.id = "lk-embed-iframe";

  // Build iframe src URL from sandboxId - use /embed-popup to get the rounded popup design
  try {
    const embedUrl = new URL("/embed-popup", sandboxIdAttribute);
    iframe.src = embedUrl.toString();
  } catch (e) {
    console.error("[Page Automation] Invalid sandbox ID:", sandboxIdAttribute);
    return;
  }

  iframe.style.cssText = `
    width: 100% !important;
    height: 100% !important;
    border: none !important;
    background: transparent !important;
    overflow: visible !important;
    pointer-events: auto !important;
  `;

  // Required permissions for microphone access
  iframe.allow = "microphone *; autoplay *";
  iframe.setAttribute("allowtransparency", "true");

  // Handle messages from iframe
  window.addEventListener("message", (event) => {
    // Verify origin matches sandboxId
    try {
      const serverOrigin = new URL(sandboxIdAttribute).origin;
      if (event.origin !== serverOrigin) {
        return;
      }
    } catch (e) {
      return;
    }

    if (!event.data || !event.data.type) {
      return;
    }

    const messageType = event.data.type;

    // Handle resize requests from iframe
    if (messageType === "lk-embed-resize") {
      const { width, height } = event.data;
      if (typeof width === "number" && typeof height === "number") {
        const currentWidth = wrapper.offsetWidth;
        const currentHeight = wrapper.offsetHeight;
        const isShrinking = width < currentWidth || height < currentHeight;
        const applyResize = (): void => {
          wrapper.style.width = `${width}px`;
          wrapper.style.height = `${height}px`;
        };

        if (shrinkTimer !== null) {
          window.clearTimeout(shrinkTimer);
          shrinkTimer = null;
        }

        console.log("[Page Automation] Resizing to:", width, "x", height);

        // Match sera behavior: grow immediately, delay shrink until close animation settles.
        if (isShrinking) {
          shrinkTimer = window.setTimeout(() => {
            applyResize();
            shrinkTimer = null;
          }, SHRINK_DELAY_MS);
        } else {
          applyResize();
        }
      }
    }

    // Handle ready signal - send initial DOM
    if (messageType === "lk-embed-ready") {
      console.log("[Page Automation] ✅ Iframe ready! Sending DOM...");
      iframeWindow = iframe.contentWindow;
      // Send DOM after a delay to ensure everything is ready
      setTimeout(() => {
        const domData = collectDOM();
        lastDOMSnapshot = domData;
        sendDOMToIframe(domData);
      }, 300);
    }

    // Handle DOM request from iframe
    if (messageType === "lk-request-dom") {
      console.log("[Page Automation] DOM requested by iframe");
      const domData = collectDOM();
      lastDOMSnapshot = domData;
      sendDOMToIframe(domData);
    }

    // Handle action execution request from iframe
    if (messageType === "lk-execute-action") {
      const { action, data, requestId } = event.data;
      console.log("[Page Automation] Action requested:", action);
      const result = executeAction(action, data);

      // Send result back to iframe
      if (iframeWindow) {
        iframeWindow.postMessage(
          {
            type: "lk-action-result",
            requestId,
            ...result,
          },
          "*",
        );
      }

      // After action, send updated DOM after a delay (and a second pass for async route/hydration updates)
      setTimeout(() => {
        const domData = collectDOM();
        lastDOMSnapshot = domData;
        sendDOMToIframe(domData);
      }, 450);
      if (action === "navigate" || action === "click_button") {
        setTimeout(() => {
          const domData = collectDOM();
          lastDOMSnapshot = domData;
          sendDOMToIframe(domData);
        }, 1400);
      }
    }

    // Handle popup open request from iframe (for script tag mode - trigger is in iframe)
    // This allows the iframe to request popup toggle from parent
    if (messageType === "lk-request-open-popup") {
      console.log("[Page Automation] Popup toggle requested from iframe");
      if (iframeWindow) {
        iframeWindow.postMessage({ type: "lk-open-popup" }, "*");
      }
    }
  });

  iframe.onload = () => {
    console.log("[Page Automation] Iframe loaded successfully");
    iframeWindow = iframe.contentWindow;
  };

  iframe.onerror = (e) => {
    console.error("[Page Automation] Iframe failed to load:", e);
  };

  wrapper.appendChild(iframe);
  document.body.appendChild(wrapper);
  console.log("[Page Automation] Iframe wrapper added to body");
}

// ===== Send DOM to iframe (script tag mode) =====
function sendDOMToIframe(domData: DOMElementsJSON): void {
  if (iframeWindow) {
    iframeWindow.postMessage(
      {
        type: "lk-dom-data",
        data: domData,
      },
      "*",
    );
    console.log(
      "[Page Automation] DOM sent to iframe:",
      domData.nIntr,
      "elements",
    );
  }
}

// ===== Main Initialization =====
function init(): void {
  console.log("[Page Automation] Initializing...");
  console.log(
    "[Page Automation] Mode:",
    isScriptTagMode
      ? "Script Tag (with iframe)"
      : "Extension (DOM collector only)",
  );

  // Initialize change detection (uses same utils as popup mode)
  console.log("[Page Automation] Initializing change detection...");
  initializeChangeDetection();

  // ⚠️ REMOVED: initializeRegenAndDiffMutationObserver() call
  // The new regenAndDiff auto-initializes via detector.initialize() when module loads
  console.log("[Page Automation] RegenAndDiff auto-initialized (class-based)");

  // Set up callbacks
  console.log("[Page Automation] Setting up callbacks...");

  if (isScriptTagMode) {
    // Script tag mode: send DOM updates to iframe
    setChangeDetectionCallback((data) => {
      handleChangeDetection(data);
      // Also send updated DOM to iframe
      setTimeout(() => {
        const newDOM = collectDOM();
        lastDOMSnapshot = newDOM;
        sendDOMToIframe(newDOM);
      }, 200);
    });

    // ⚠️ CHANGED: setAddedOrRemovedCallback is now setDOMChangeCallback internally
    // but the exported name is still setAddedOrRemovedCallback for compatibility
    setAddedOrRemovedCallback(() => {
      handleDOMChange();
      // Also send updated DOM to iframe
      const newDOM = collectDOM();
      lastDOMSnapshot = newDOM;
      sendDOMToIframe(newDOM);
    });

    setUrlChangeCallback(() => {
      handleUrlChange();
      // Also send updated DOM to iframe
      const newDOM = collectDOM();
      lastDOMSnapshot = newDOM;
      sendDOMToIframe(newDOM);
    });

    // Create iframe
    createIframeEmbed();
  } else {
    // Extension mode: send DOM updates via postMessage to content script
    setChangeDetectionCallback(handleChangeDetection);
    setAddedOrRemovedCallback(handleDOMChange); // ⚠️ CHANGED: Now maps to setDOMChangeCallback
    setUrlChangeCallback(handleUrlChange);
  }

  // Initialize message handler (for extension mode communication + niceone-frame-load updates)
  window.addEventListener("message", (event: MessageEvent) => {
    handleMessage(event);
    if (event.data && event.data.type === "niceone-frame-load" && isScriptTagMode) {
      setTimeout(() => {
        const domData = collectDOM();
        lastDOMSnapshot = domData;
        sendDOMToIframe(domData);
      }, 350);
      setTimeout(() => {
        const domData = collectDOM();
        lastDOMSnapshot = domData;
        sendDOMToIframe(domData);
      }, 1200);
    }
  });

  // Get initial DOM snapshot
  lastDOMSnapshot = collectDOM();

  // Notify content script that we're ready (extension mode)
  if (!isScriptTagMode) {
    window.postMessage({ type: "voice-agent-dom-collector-ready" }, "*");
  }

  console.log("[Page Automation] Initialized and listening for messages");
  console.log(
    "[Page Automation] Using unified utils: changeDetection, regenAndDiff (class-based), interactiveDomSerializer, siteAutomation",
  );
}

// Start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
