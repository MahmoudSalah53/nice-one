// Background service worker for the Chrome extension

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Set default values on first install
    chrome.storage.sync.set({
      enabled: true,
      sandboxId: "http://localhost:3000",
      bundleUrl: "",
    });

    // Open options page on first install
    chrome.runtime.openOptionsPage();
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggle") {
    chrome.storage.sync.get(["enabled"], (result) => {
      const newEnabled = !result.enabled;
      chrome.storage.sync.set({ enabled: newEnabled }, () => {
        // Reload current tab to apply changes
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.reload(tabs[0].id);
          }
        });
        sendResponse({ enabled: newEnabled });
      });
    });
    return true; // Keep the message channel open for async response
  }

  if (request.action === "getStatus") {
    chrome.storage.sync.get(["enabled", "sandboxId", "bundleUrl"], (result) => {
      sendResponse({
        enabled: result.enabled !== false,
        sandboxId: result.sandboxId || "http://localhost:3000",
        bundleUrl: result.bundleUrl || "",
      });
    });
    return true;
  }

  // Proxy fetch requests to bypass CORS and mixed content restrictions
  if (request.action === "fetch") {
    const { url, options } = request;
    fetch(url, options)
      .then(async (response) => {
        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
        sendResponse({
          success: true,
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          data: data,
          headers: Object.fromEntries(response.headers.entries()),
        });
      })
      .catch((error) => {
        sendResponse({
          success: false,
          error: error.message,
        });
      });
    return true; // Keep the message channel open for async response
  }
});
