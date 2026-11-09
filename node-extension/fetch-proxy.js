// Fetch proxy injected into page context to bypass CORS and mixed content restrictions
(function () {
  if (window.__voiceAgentFetchProxy) return;

  window.__voiceAgentFetchProxy = function (url, options) {
    return new Promise((resolve, reject) => {
      // Use postMessage to communicate with content script
      const messageId = "fetch_" + Date.now() + "_" + Math.random();

      const messageHandler = (event) => {
        if (
          event.data.type === "voice-agent-fetch-response" &&
          event.data.id === messageId
        ) {
          window.removeEventListener("message", messageHandler);
          if (event.data.success) {
            // Create a Response-like object
            const response = {
              ok: event.data.ok,
              status: event.data.status,
              statusText: event.data.statusText,
              headers: new Headers(event.data.headers || {}),
              json: async () => event.data.data,
              text: async () =>
                typeof event.data.data === "string"
                  ? event.data.data
                  : JSON.stringify(event.data.data),
              clone: function () {
                return this;
              },
            };
            resolve(response);
          } else {
            reject(new Error(event.data.error || "Fetch failed"));
          }
        }
      };

      window.addEventListener("message", messageHandler);

      // Send request to content script
      window.postMessage(
        {
          type: "voice-agent-fetch-request",
          id: messageId,
          url: url,
          options: options,
        },
        "*"
      );
    });
  };
})();
