// Get server URL from query params
const params = new URLSearchParams(window.location.search);
const serverUrl = params.get("server") || "http://localhost:3000";

console.log("[Nice One Extension Wrapper] Initializing with server URL:", serverUrl);

// Set iframe src
const iframe = document.getElementById("inner-iframe");
const iframeSrc = `${serverUrl}/embed-popup`;
iframe.src = iframeSrc;

let innerIframeReady = false;
let pendingMessages = [];

// When inner iframe loads
iframe.onload = () => {
  console.log("[Nice One Extension Wrapper] Inner iframe loaded successfully");
  innerIframeReady = true;

  // Send any pending messages
  if (pendingMessages.length > 0) {
    console.log(
      "[Nice One Extension Wrapper] Sending",
      pendingMessages.length,
      "pending messages",
    );
    pendingMessages.forEach((msg) => {
      try {
        iframe.contentWindow.postMessage(msg, "*");
        console.log("[Nice One Extension Wrapper] Sent pending message:", msg.type);
      } catch (e) {
        console.error(
          "[Nice One Extension Wrapper] Error sending pending message:",
          e,
        );
      }
    });
    pendingMessages = [];
  }
};

iframe.onerror = (e) => {
  console.error("[Nice One Extension Wrapper] Inner iframe failed to load:", e);
};

// Forward messages between inner iframe and parent window
window.addEventListener("message", (event) => {
  if (!event.data || !event.data.type) return;

  const msgType = event.data.type;

  // Determine message direction based on source
  // If it's from the inner iframe
  if (event.source === iframe.contentWindow) {
    console.log("[Nice One Extension Wrapper] → Parent:", msgType);
    window.parent.postMessage(event.data, "*");
    return;
  }

  // If it's from parent (content script)
  if (event.source === window.parent) {
    console.log("[Nice One Extension Wrapper] → Inner iframe:", msgType);

    // Handle lk-open-popup message specifically
    if (msgType === "lk-open-popup") {
      console.log("[Nice One Extension Wrapper] Open popup requested from parent");
      if (innerIframeReady && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage({ type: "lk-open-popup" }, "*");
        } catch (e) {
          console.error(
            "[Nice One Extension Wrapper] Error forwarding open-popup:",
            e,
          );
        }
      } else {
        console.log(
          "[Nice One Extension Wrapper] Queueing lk-open-popup (iframe not ready)",
        );
        pendingMessages.push({ type: "lk-open-popup" });
      }
      return;
    }

    // Forward other messages normally
    if (innerIframeReady && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage(event.data, "*");
      } catch (e) {
        console.error("[Nice One Extension Wrapper] Error forwarding to iframe:", e);
      }
    } else {
      console.log(
        "[Nice One Extension Wrapper] Queueing message (iframe not ready):",
        msgType,
      );
      pendingMessages.push(event.data);
    }
    return;
  }

  // Unknown source - might be from iframe's child frames
  console.log("[Nice One Extension Wrapper] Message from unknown source:", msgType);
});

console.log("[Nice One Extension Wrapper] Loading popup from:", iframeSrc);
