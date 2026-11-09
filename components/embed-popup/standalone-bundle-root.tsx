import * as React from "react";
import ReactDOM from "react-dom/client";
import { getAppConfig } from "@/lib/env";
import { getGlobalsCss } from "@/styles/globals";
import {
  setCurrentPageUrl,
  getResolvedUrl,
} from "@/utils/serializerVersionFromUrl";
import EmbedFixedAgentClient from "./agent-client";
import { initializeChangeDetection } from "@/utils/changeDetection";
// import { initializeRegenAndDiffMutationObserver } from "@/utils/regenAndDiff";
import { setLogLevel } from "livekit-client";

// Set LiveKit log level early to suppress verbose connection logs
// Only show errors by default - set to "debug" or "warn" for more details
setLogLevel("error");

// Set current page URL for DOM context at runtime
setCurrentPageUrl(typeof window !== "undefined" ? window.location.href : null);
if (typeof window !== "undefined") {
  console.log("[Embed] Serializer version: node");
  console.log("[Embed] Resolved URL:", getResolvedUrl());
}

// Explicitly initialize change detection
console.log("[STANDALONE BUNDLE] Initializing change detection...");
initializeChangeDetection();
console.log("[STANDALONE BUNDLE] Initializing mutation observer...");
// initializeRegenAndDiffMutationObserver();
const scriptTag = document.querySelector<HTMLScriptElement>(
  "script[data-lk-sandbox-id]",
);
const sandboxIdAttribute = scriptTag?.dataset.lkSandboxId;

if (sandboxIdAttribute) {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("id", "lk-embed-wrapper");
  document.body.appendChild(wrapper);

  // Use a shadow root so that any relevant css classes don't leak out and effect the broader page
  const shadowRoot = wrapper.attachShadow({ mode: "open" });

  // Include app styles (node theme)
  const styleTag = document.createElement("style");
  styleTag.textContent = getGlobalsCss();
  shadowRoot.appendChild(styleTag);

  const reactRoot = document.createElement("div");
  shadowRoot.appendChild(reactRoot);

  getAppConfig(window.location.origin, sandboxIdAttribute)
    .then((appConfig) => {
      const root = ReactDOM.createRoot(reactRoot);
      root.render(<EmbedFixedAgentClient appConfig={appConfig} />);
    })
    .catch((err) => {
      console.error(
        "LiveKit popup embed error - Error loading app config:",
        err,
      );
    });
} else {
  console.error(
    "LiveKit popup embed error - no data-lk-sandbox-id attribute found on script tag. This is required!",
  );
}
