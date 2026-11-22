"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { getAppConfig } from "@/lib/env";
import { AppConfig } from "@/lib/types";
import type { DOMElementsJSON } from "@/utils/interactiveDomSerializer";
import {
  setCurrentPageUrl,
} from "@/utils/serializerVersionFromUrl";

// Extend Window interface for iframe bridge
declare global {
  interface Window {
    __iframeDOMData: DOMElementsJSON | null;
    __iframeMode: boolean;
    __requestParentDOM: () => void;
    __executeParentAction: (
      action: string,
      data: Record<string, unknown>,
    ) => Promise<{ success: boolean; error?: string } & Record<string, unknown>>;
    __iframeChangeCallbacks: Set<(data: unknown) => void>;
  }
}

// Dynamically import to avoid SSR issues with document access
const EmbedFixedAgentClient = dynamic(
  () => import("@/components/embed-popup/agent-client"),
  { ssr: false },
);

export default function EmbedPopupPage() {
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSizeRef = useRef({ width: 0, height: 0 });
  const pendingActionsRef = useRef<
    Map<
      string,
      (result: { success: boolean; error?: string } & Record<string, unknown>) => void
    >
  >(new Map());

  // Check if running in iframe
  const isInIframe = typeof window !== "undefined" && window.parent !== window;

  // Notify parent window (goes through iframe-wrapper to content-script)
  const notifyParent = useCallback(
    (type: string, data: Record<string, unknown> = {}) => {
      if (typeof window !== "undefined" && window.parent !== window) {
        console.log("[Embed Popup] → Parent:", type);
        window.parent.postMessage({ type, ...data }, "*");
      }
    },
    [],
  );

  // Inject node CSS on mount (fallback until we receive parent URL via lk-dom-data)
  useEffect(() => {
    const styleId = "dynamic-globals-css";

    const injectCss = async () => {
      try {
        const cssUrl = "/css/globals_node.css";
        const response = await fetch(cssUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch CSS: ${response.status} ${response.statusText}`,
          );
        }
        const cssContent = await response.text();
        let styleElement = document.getElementById(styleId) as HTMLStyleElement;
        if (!styleElement) {
          styleElement = document.createElement("style");
          styleElement.id = styleId;
          document.head.appendChild(styleElement);
        }
        styleElement.textContent = cssContent;
        return true;
      } catch (error) {
        console.error("[Embed Iframe] Error loading CSS:", error);
        return false;
      }
    };

    injectCss();

    return () => {
      const element = document.getElementById(styleId);
      if (element) element.remove();
    };
  }, []);

  // Set up iframe bridge
  useEffect(() => {
    if (!isInIframe) return;

    console.log("[Embed Popup] Running in iframe mode - setting up DOM bridge");

    // Mark iframe mode
    window.__iframeMode = true;
    window.__iframeDOMData = null;
    window.__iframeChangeCallbacks = new Set();

    // Function to request DOM from parent
    window.__requestParentDOM = () => {
      notifyParent("lk-request-dom", {});
    };

    // Function to execute action via parent
    window.__executeParentAction = (
      action: string,
      data: Record<string, unknown>,
    ) => {
      return new Promise((resolve) => {
        const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Store callback
        pendingActionsRef.current.set(requestId, resolve);

        // Send request to parent
        notifyParent("lk-execute-action", { action, data, requestId });

        // Timeout after 10 seconds
        setTimeout(() => {
          if (pendingActionsRef.current.has(requestId)) {
            pendingActionsRef.current.delete(requestId);
            resolve({ success: false, error: "Action timed out" });
          }
        }, 10000);
      });
    };

    return () => {
      window.__iframeMode = false;
      window.__iframeDOMData = null;
    };
  }, [isInIframe, notifyParent]);

  useEffect(() => {
    // Load app config
    getAppConfig(window.location.origin, window.location.origin)
      .then((config) => {
        setAppConfig(config);
        // Notify parent that we're ready
        notifyParent("lk-embed-ready", {});

        // Request initial DOM if in iframe mode
        if (isInIframe) {
          setTimeout(() => {
            notifyParent("lk-request-dom", {});
          }, 500);
        }
      })
      .catch((err) => {
        console.error("[Embed Popup] Error loading config:", err);
        setError(err.message);
      });
  }, [notifyParent, isInIframe]);

  // Listen for messages from parent
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data?.type) return;

      console.log("[Embed Popup] ← Parent:", event.data.type);
      // Handle theme changes
      if (event.data.type === "lk-set-theme") {
        document.documentElement.classList.toggle("dark", event.data.dark);
      }

      // Handle DOM data from parent (iframe mode)
      if (event.data.type === "lk-dom-data") {
        const data = event.data.data;
        console.log("[Embed Popup] ✅ Received DOM data from parent!");
        console.log("[Embed Popup] - Elements:", data?.nIntr);
        console.log(
          "[Embed Popup] - Interactive:",
          data?.interactiveElements?.length,
        );
        console.log("[Embed Popup] - URL:", data?.url);

        window.__iframeDOMData = data;

        // Use parent page URL for DOM context (iframe URL is not the tab URL)
        const parentUrl = data?.url ?? "";
        if (parentUrl) {
          setCurrentPageUrl(parentUrl);
          // Only inject node CSS if not already loaded on mount
          const styleElement = document.getElementById(
            "dynamic-globals-css",
          ) as HTMLStyleElement | null;
          if (!styleElement || !styleElement.textContent) {
            (async () => {
              try {
                const response = await fetch("/css/globals_node.css");
                if (response.ok) {
                  const cssContent = await response.text();
                  const el = document.getElementById(
                    "dynamic-globals-css",
                  ) as HTMLStyleElement | null;
                  if (el && !el.textContent) {
                    el.textContent = cssContent;
                  }
                }
              } catch (e) {
                console.error("[Embed Iframe] Error loading node CSS", e);
              }
            })();
          }
        }

        // Dispatch custom event for RPC senders to pick up
        window.dispatchEvent(
          new CustomEvent("iframe-dom-updated", { detail: data }),
        );
      }

      // Handle element change events from parent (iframe mode)
      if (event.data.type === "lk-element-changed") {
        console.log(
          "[Embed Popup] Element changed in parent:",
          event.data.data,
        );

        // Notify all registered callbacks
        window.__iframeChangeCallbacks?.forEach((callback) => {
          try {
            callback(event.data.data);
          } catch (e) {
            console.error("[Embed Popup] Error in change callback:", e);
          }
        });
      }

      // Handle action result from parent
      if (event.data.type === "lk-action-result") {
        const { type: _msgType, requestId, ...resultPayload } = event.data;
        void _msgType;
        const callback = pendingActionsRef.current.get(requestId);
        if (callback) {
          pendingActionsRef.current.delete(requestId);
          callback({
            success: Boolean(resultPayload.success),
            ...resultPayload,
          });
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Observe size changes and notify parent
  useEffect(() => {
    if (!appConfig) return;

    const checkAndNotifySize = () => {
      const svwRoot = document.querySelector(".svw-root") as HTMLElement | null;
      let width = 104;
      let height = 104;

      if (svwRoot) {
        const phase = svwRoot.getAttribute("data-phase") || "closed";
        const tease = svwRoot.getAttribute("data-tease") === "1";
        const hover = svwRoot.getAttribute("data-hover") === "1";
        if (phase !== "closed") {
          width = 356;
          height = 112;
        } else if (tease || hover) {
          width = 224;
          height = 104;
        }
      } else {
        const isPopupOpen =
          typeof window !== "undefined" &&
          (window as unknown as { __popupOpen?: boolean }).__popupOpen;
        if (isPopupOpen) {
          width = 356;
          height = 112;
        }
      }

      if (
        Math.abs(width - lastSizeRef.current.width) > 2 ||
        Math.abs(height - lastSizeRef.current.height) > 2
      ) {
        lastSizeRef.current = { width, height };
        notifyParent("lk-embed-resize", { width, height });
      }
    };

    setTimeout(checkAndNotifySize, 100);

    const observer = new MutationObserver(() => {
      requestAnimationFrame(checkAndNotifySize);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(checkAndNotifySize);
    });
    resizeObserver.observe(document.body);

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
    };
  }, [appConfig, notifyParent]);

  if (error) {
    return (
      <div
        style={{
          padding: "16px",
          color: "#dc2626",
          fontFamily: "system-ui, sans-serif",
          fontSize: "14px",
          background: "#fef2f2",
          borderRadius: "8px",
          margin: "8px",
        }}
      >
        <strong>Error:</strong> {error}
      </div>
    );
  }

  if (!appConfig) {
    return null;
  }

  return <EmbedFixedAgentClient appConfig={appConfig} />;
}
