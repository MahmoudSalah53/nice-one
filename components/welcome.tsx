"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { CheckIcon, CopyIcon, HandPointingIcon } from "@phosphor-icons/react";
import { APP_CONFIG_DEFAULTS } from "@/app-config";
import { THEME_STORAGE_KEY, getSandboxId } from "@/lib/env";
import type { ThemeMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import EmbedPopupAgentClient from "./embed-popup/agent-client";
import { ThemeToggle } from "./theme-toggle";
import { serializerInstance } from "@/utils/interactiveDomSerializer";
import SiteAutomation from "@/utils/siteAutomation";
import type { DOMElementsJSON } from "@/utils/interactiveDomSerializer";

export default function Welcome() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const selectedTab = tabParam
    ? tabParam === "popup"
      ? "popup"
      : "iframe"
    : "iframe";
  const [, forceUpdate] = useState(0);
  const theme =
    (localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode) ?? "dark";
  const IS_SANDBOX_ENVIRONMENT = process.env.NODE_ENV === "production";

  const [copied, setCopied] = useState(false);
  const copyEmbedCode = useCallback((embedCode: string) => {
    navigator.clipboard.writeText(embedCode);

    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 1000);
  }, []);

  const iframeEmbedUrl = useMemo(() => {
    const url = new URL("/embed-popup", window.location.origin);
    url.searchParams.set("theme", theme);
    return url.toString();
  }, [theme]);

  const popupEmbedUrl = useMemo(() => {
    const url = new URL("/embed-popup.js", window.location.origin);
    return url.toString();
  }, []);

  const iframeScriptUrl = useMemo(() => {
    const url = new URL("/page-automation.js", window.location.origin);
    return url.toString();
  }, []);

  const embedSandboxId = useMemo(
    () => getSandboxId(window.location.origin),
    [],
  );

  const popupEmbedCode = useMemo(
    () =>
      `<script\n  src="${popupEmbedUrl}"\n  data-lk-sandbox-id="${embedSandboxId}"\n></script>`,
    [popupEmbedUrl, embedSandboxId],
  );
  const iframeEmbedCode = useMemo(() => {
    return `<iframe\n  src="${iframeEmbedUrl}"\n  style="width: 320px; height: 64px;"\n></iframe>`;
  }, [iframeEmbedUrl]);

  const iframeScriptEmbedCode = useMemo(() => {
    return `<script\n  src="${iframeScriptUrl}"\n  data-lk-sandbox-id="${embedSandboxId}"\n></script>`;
  }, [iframeScriptUrl, embedSandboxId]);

  const popupTestUrl = useMemo(() => {
    const url = new URL("/test/popup", window.location.origin);
    return url.toString();
  }, []);

  const handleClickIframe = () => {
    router.push(`${pathname}?tab=iframe`);
  };

  const handleClickPopup = () => {
    router.push(`${pathname}?tab=popup`);
  };

  // Handle iframe messages (resize, DOM requests, actions)
  const wrapperRef = useRef<HTMLDivElement>(null);
  const iframeWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    if (selectedTab !== "iframe") return;

    // Collect DOM data
    const collectDOM = (): DOMElementsJSON => {
      return serializerInstance.getInteractiveElementsAsJson(document.body, {
        resetCounter: true,
      });
    };

    // Send DOM to iframe
    const sendDOMToIframe = (domData: DOMElementsJSON) => {
      if (iframeWindowRef.current) {
        iframeWindowRef.current.postMessage(
          {
            type: "lk-dom-data",
            data: domData,
          },
          "*",
        );
        console.log("[Welcome] DOM sent to iframe:", domData.nIntr, "elements");
      }
    };

    // Execute action
    const executeAction = (
      action: string,
      data: Record<string, unknown>,
    ): { success: boolean; error?: string } => {
      try {
        switch (action) {
          case "click_button": {
            const success = SiteAutomation.click_button(data.jsId as string);
            return { success, error: success ? undefined : "Element not found" };
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
            const success = SiteAutomation.select_mat_option(data.jsId as string);
            return { success, error: success ? undefined : "Element not found" };
          }
          default:
            return { success: false, error: `Unknown action: ${action}` };
        }
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    };

    const handleMessage = (event: MessageEvent) => {
      if (!event.data?.type) return;

      // Verify origin matches our server
      try {
        const serverOrigin = new URL(window.location.origin).origin;
        if (event.origin !== serverOrigin && !event.origin.startsWith("http://localhost") && !event.origin.startsWith("http://127.0.0.1")) {
          return;
        }
      } catch {
        // Ignore origin check errors
      }

      const messageType = event.data.type;

      // Handle resize requests from iframe
      if (messageType === "lk-embed-resize") {
        const { width, height } = event.data;
        if (width && height && wrapperRef.current) {
          wrapperRef.current.style.width = `${width}px`;
          wrapperRef.current.style.height = `${height}px`;
        }
      }

      // Handle ready signal - send initial DOM
      if (messageType === "lk-embed-ready") {
        console.log("[Welcome] ✅ Iframe ready! Sending DOM...");
        iframeWindowRef.current = event.source as Window;
        setTimeout(() => {
          const domData = collectDOM();
          sendDOMToIframe(domData);
        }, 300);
      }

      // Handle DOM request from iframe
      if (messageType === "lk-request-dom") {
        console.log("[Welcome] DOM requested by iframe");
        iframeWindowRef.current = event.source as Window;
        const domData = collectDOM();
        sendDOMToIframe(domData);
      }

      // Handle action execution request from iframe
      if (messageType === "lk-execute-action") {
        const { action, data, requestId } = event.data;
        console.log("[Welcome] Action requested:", action);
        iframeWindowRef.current = event.source as Window;
        const result = executeAction(action, data);

        // Send result back to iframe
        if (iframeWindowRef.current) {
          iframeWindowRef.current.postMessage(
            {
              type: "lk-action-result",
              requestId,
              ...result,
            },
            "*",
          );
        }

        // After action, send updated DOM after a delay
        setTimeout(() => {
          const domData = collectDOM();
          sendDOMToIframe(domData);
        }, 500);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [selectedTab]);

  return (
    <div className="text-fg1 mx-auto flex min-h-screen max-w-prose flex-col justify-center py-4 md:py-20">
      <div className="h-[520px] space-y-10 px-4">
        <div className="items-top flex justify-between">
          <h1 className="text-fg0 text-2xl font-bold text-pretty">
            Voice Agent Embed
          </h1>
          <div className="mt-1 flex items-center gap-3">
            <a
              href="/rpctester"
              className="text-fg2 hover:text-fgAccent focus:text-fgAccent text-sm font-medium transition-colors underline underline-offset-4"
            >
              RPC Tester
            </a>
            <div className="sr-only">Toggle theme:</div>
            <ThemeToggle
              className="w-auto"
              onClick={() => forceUpdate((c) => c + 1)}
            />
          </div>
        </div>

        <div>
          <div className="text-fg0 mb-1 font-semibold">Select a variant</div>
          <div className="border-separator2 rounded-xl border p-1">
            <div className="relative flex gap-2">
              <motion.div
                key="selectedTab"
                layout="position"
                layoutId="tab-indicator"
                initial={false}
                animate={
                  selectedTab === "iframe" ? { left: 0 } : { left: "50%" }
                }
                transition={{ duration: 0.3, type: "spring", bounce: 0 }}
                className="bg-bgAccent/50 dark:bg-bgAccent border-primary/20 dark:border-separatorAccent absolute top-0 h-full w-1/2 rounded-lg border"
              />
              <button
                type="button"
                onClick={handleClickIframe}
                className={cn(
                  "text-fg2 focus:text-fgAccent hover:text-fgAccent z-10 flex-1 cursor-pointer py-2 font-mono transition-colors",
                  selectedTab === "iframe" && "text-fgAccent font-bold",
                )}
              >
                iFrame
              </button>
              <button
                type="button"
                onClick={handleClickPopup}
                className={cn(
                  "text-fg2 focus:text-fgAccent hover:text-fgAccent z-10 flex-1 cursor-pointer py-2 font-mono transition-colors",
                  selectedTab === "popup" && "text-fgAccent font-bold",
                )}
              >
                Popup
              </button>
            </div>
          </div>
        </div>

        {selectedTab === "iframe" && (
          <>
            <h3 className="sr-only text-lg font-semibold">IFrame Style</h3>
            <div>
              <h4 className="text-fg0 mb-1 font-semibold">
                Option 1: IFrame embed code
              </h4>
              <pre className="border-separator2 bg-bg2 scrollbar-custom relative overflow-auto rounded-md border px-2 py-1">
                <code className="font-mono">
                  {iframeEmbedCode
                    .split(iframeEmbedUrl)
                    .map((stringPart, index) => {
                      if (index === 0) {
                        return <span key={index}>{stringPart}</span>;
                      }

                      return (
                        <span key={index}>
                          <a
                            href={iframeEmbedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline"
                          >
                            {iframeEmbedUrl}
                          </a>
                          {stringPart}
                        </span>
                      );
                    })}
                </code>
                <div className="absolute top-0 right-0">
                  <button
                    onClick={() => copyEmbedCode(iframeEmbedCode)}
                    className="cursor-pointer p-2 opacity-50 transition-opacity hover:opacity-100"
                  >
                    {copied ? (
                      <CheckIcon weight="bold" className="text-fgSuccess" />
                    ) : (
                      <CopyIcon />
                    )}
                  </button>
                </div>
              </pre>
            </div>
            <div>
              <h4 className="text-fg0 mb-1 font-semibold">
                Option 2: Script tag embed code
              </h4>
              <pre className="border-separator2 bg-bg2 scrollbar-custom relative overflow-auto rounded-md border px-2 py-1">
                <code className="font-mono">{iframeScriptEmbedCode}</code>
                <div className="absolute top-0 right-0">
                  <button
                    onClick={() => copyEmbedCode(iframeScriptEmbedCode)}
                    className="cursor-pointer p-2 opacity-50 transition-opacity hover:opacity-100"
                  >
                    {copied ? (
                      <CheckIcon weight="bold" className="text-fgSuccess" />
                    ) : (
                      <CopyIcon />
                    )}
                  </button>
                </div>
              </pre>
              {!IS_SANDBOX_ENVIRONMENT && (
                <p className="text-fg4 mt-2 text-sm">
                  Run <code className="text-fg0">pnpm build-embed-scripts</code>{" "}
                  to build both embed scripts.
                </p>
              )}
            </div>
            <div className="flex justify-center pt-8">
              <div className="text-fgAccent flex gap-1">
                <p className="grow text-sm">
                  The iframe should appear in the bottom right corner of
                  the screen
                </p>
                <HandPointingIcon
                  size={16}
                  weight="regular"
                  className="mt-0.5 inline shrink-0 rotate-[145deg] animate-bounce"
                />
              </div>
            </div>
            <div
              ref={wrapperRef}
              id="lk-iframe-embed-wrapper"
              style={{
                position: "fixed",
                bottom: "16px",
                right: "16px",
                zIndex: 2147483647,
                width: "100px",
                height: "100px",
                border: "none",
                background: "transparent",
                pointerEvents: "auto",
              }}
            >
              <iframe
                src={iframeEmbedUrl}
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  background: "transparent",
                  overflow: "visible",
                  pointerEvents: "auto",
                }}
                allow="microphone *; autoplay *"
                allowTransparency={true}
                className="opacity-100 transition-opacity duration-500 [@starting-style]:opacity-0"
                onLoad={(e) => {
                  iframeWindowRef.current = (e.target as HTMLIFrameElement).contentWindow;
                }}
              />
            </div>
          </>
        )}

        {selectedTab === "popup" && (
          <>
            <h3 className="sr-only text-lg font-semibold">Popup Style</h3>
            <div>
              <h4 className="text-fg0 mb-1 font-semibold">Embed code</h4>
              <pre className="order-separator2 bg-bg2 scrollbar-custom relative overflow-auto rounded-md border px-2 py-1">
                <code className="font-mono">{popupEmbedCode}</code>
                <div className="absolute top-0 right-0">
                  <button
                    onClick={() => copyEmbedCode(popupEmbedCode)}
                    className="cursor-pointer p-2 opacity-50 transition-opacity hover:opacity-100"
                  >
                    {copied ? (
                      <CheckIcon weight="bold" className="text-fgSuccess" />
                    ) : (
                      <CopyIcon />
                    )}
                  </button>
                </div>
              </pre>
              {/* hide build/test instructions in sandbox environment on Vercel */}
              {!IS_SANDBOX_ENVIRONMENT && (
                <div className="my-4">
                  <p className="text-fg4 overflow-hidden text-sm text-ellipsis whitespace-nowrap">
                    To apply local changes, run{" "}
                    <code className="text-fg0">
                      pnpm build-embed-popup-script
                    </code>
                    .
                  </p>
                  <p className="text-fg4 overflow-hidden text-sm text-ellipsis whitespace-nowrap">
                    Test your latest build at{" "}
                    <a
                      href={popupTestUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      {popupTestUrl}
                    </a>
                    .
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-center pt-8">
              <div className="text-fgAccent flex gap-1">
                <p className="grow text-sm">
                  The popup button should appear in the bottom right corner of
                  the screen
                </p>
                <HandPointingIcon
                  size={16}
                  weight="regular"
                  className="mt-0.5 inline shrink-0 rotate-[145deg] animate-bounce"
                />
              </div>
            </div>
            <EmbedPopupAgentClient appConfig={APP_CONFIG_DEFAULTS} />
          </>
        )}
      </div>
    </div>
  );
}
