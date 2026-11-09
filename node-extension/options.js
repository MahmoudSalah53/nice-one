// Options page script

// Load current settings
chrome.storage.sync.get(["enabled", "sandboxId", "bundleUrl"], (result) => {
  document.getElementById("enabled").checked = result.enabled !== false;
  document.getElementById("sandboxId").value =
    result.sandboxId || "http://localhost:3000";
  document.getElementById("bundleUrl").value = result.bundleUrl || "";
});

// Handle form submission
document.getElementById("optionsForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const enabled = document.getElementById("enabled").checked;
  const sandboxId = document.getElementById("sandboxId").value.trim();
  const bundleUrl = document.getElementById("bundleUrl").value.trim();

  if (!sandboxId) {
    showStatus("Please enter a Server URL", "error");
    return;
  }

  chrome.storage.sync.set(
    {
      enabled,
      sandboxId,
      bundleUrl: bundleUrl || "",
    },
    () => {
      showStatus("Settings saved successfully! Reloading tabs...", "success");

      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (
            tab.url &&
            (tab.url.startsWith("http://") || tab.url.startsWith("https://"))
          ) {
            chrome.tabs.reload(tab.id);
          }
        });
      });
    },
  );
});

function showStatus(message, type) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.className = `status ${type}`;
  status.style.display = "block";

  setTimeout(() => {
    status.style.display = "none";
  }, 3000);
}

// Get extension version from manifest
try {
  const manifest = chrome.runtime.getManifest();
  const versionLink = document.getElementById("versionLink");
  if (versionLink && manifest.version) {
    versionLink.textContent = `v${manifest.version}`;
  }
} catch (e) {
  // Ignore errors when manifest is not available
}
