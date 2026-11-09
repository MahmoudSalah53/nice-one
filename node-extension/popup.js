// Popup script

// Load current status
chrome.storage.sync.get(["enabled"], (result) => {
  const enabled = result.enabled !== false;
  const toggle = document.getElementById("toggle");

  if (enabled) {
    toggle.classList.add("active");
  }

  toggle.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "toggle" }, (response) => {
      if (response && response.enabled !== undefined) {
        if (response.enabled) {
          toggle.classList.add("active");
        } else {
          toggle.classList.remove("active");
        }
      }
    });
  });
});

// Open options page
document.getElementById("optionsBtn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
