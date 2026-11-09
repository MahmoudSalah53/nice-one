/**
 * Iframe Mode Events Hook
 * Handles event listeners specific to iframe mode:
 * - pagehide: Detect refresh vs iframe removal
 * - beforeunload: Preserve cookies
 * - visibilitychange: Preserve state
 * - Parent URL monitoring
 */

import { useEffect } from "react";
import { Room } from "livekit-client";
import Cookies from "js-cookie";
import { ConnectionDetails } from "@/lib/types";
import {
  POPUP_STATE_STORAGE_KEY,
  CONNECTION_DETAILS_KEY,
  IFRAME_REFRESH_FLAG_KEY,
} from "../config";
import { getCookieOptions } from "../utils";

interface UseIframeModeEventsOptions {
  popupOpen: boolean;
  room: Room;
  connectionDetails: ConnectionDetails | null;
  isManualCloseRef: React.MutableRefObject<boolean>;
  setPopupOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useIframeModeEvents({
  popupOpen,
  room,
  connectionDetails,
  isManualCloseRef,
  setPopupOpen,
}: UseIframeModeEventsOptions) {
  // Check and clear iframe refresh flag on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const isIframeMode = window.__iframeMode;
    if (!isIframeMode) return;

    try {
      const wasRefreshing = Cookies.get(IFRAME_REFRESH_FLAG_KEY);
      const hasConnectionDetails = Cookies.get(CONNECTION_DETAILS_KEY);
      const hasPopupState = Cookies.get(POPUP_STATE_STORAGE_KEY);

      if (wasRefreshing === "true") {
        Cookies.remove(IFRAME_REFRESH_FLAG_KEY, getCookieOptions());
        console.log(
          "[IFRAME MODE] ✅ Detected iframe refresh - session preserved (NOT closed)",
        );
        console.log("[IFRAME MODE] Refresh restoration check:", {
          hasConnectionDetails: !!hasConnectionDetails,
          hasPopupState: hasPopupState,
          refreshFlag: wasRefreshing,
        });

        if (hasConnectionDetails && hasPopupState === "true") {
          console.log(
            "[IFRAME MODE] ✅ All session data preserved - ready to reconnect",
          );
        } else {
          console.warn(
            "[IFRAME MODE] ⚠️ Some session data missing after refresh:",
            { hasConnectionDetails: !!hasConnectionDetails, hasPopupState },
          );
        }
      } else {
        console.log("[IFRAME MODE] No refresh detected on mount (normal load)");
      }
    } catch (error) {
      console.warn("[IFRAME MODE] Error checking refresh flag:", error);
    }
  }, []);

  // Main iframe event listeners
  useEffect(() => {
    const isIframeMode = typeof window !== "undefined" && window.__iframeMode;
    if (!isIframeMode) return;

    // Monitor parent page URL changes to preserve session on navigation
    let parentUrl: string | null = null;
    try {
      if (window.parent && window.parent !== window) {
        parentUrl = window.parent.location.href;
      }
    } catch {
      console.log(
        "[IFRAME MODE] Cannot access parent location (cross-origin), using events only",
      );
    }

    // Monitor parent URL changes if accessible
    let urlCheckInterval: NodeJS.Timeout | null = null;
    if (parentUrl !== null) {
      urlCheckInterval = setInterval(() => {
        try {
          const currentParentUrl = window.parent.location.href;
          if (currentParentUrl !== parentUrl) {
            console.log(
              "[IFRAME MODE] Parent page URL changed:",
              parentUrl,
              "→",
              currentParentUrl,
            );
            parentUrl = currentParentUrl;

            // Preserve session on parent navigation
            if (popupOpen) {
              isManualCloseRef.current = false;
              try {
                Cookies.set(
                  POPUP_STATE_STORAGE_KEY,
                  "true",
                  getCookieOptions(),
                );
                if (connectionDetails) {
                  const existing = Cookies.get(CONNECTION_DETAILS_KEY);
                  if (!existing) {
                    Cookies.set(
                      CONNECTION_DETAILS_KEY,
                      JSON.stringify(connectionDetails),
                      getCookieOptions(),
                    );
                  }
                }
                console.log(
                  "[IFRAME MODE] ✅ Cookies preserved for parent navigation",
                );
              } catch (error) {
                console.warn(
                  "[IFRAME MODE] Failed to preserve cookies on parent navigation:",
                  error,
                );
              }
            }
          }
        } catch {
          // Parent location no longer accessible
        }
      }, 500);
    }

    // pagehide: Detect refresh vs iframe removal
    const handlePageHide = (event: PageTransitionEvent) => {
      if (!popupOpen || room.state !== "connected") return;

      if (event.persisted) {
        // Page being cached (refresh) - preserve session
        console.log(
          "[IFRAME MODE] Iframe page being cached (refresh) - preserving session (NOT closing)",
        );
        try {
          Cookies.set(IFRAME_REFRESH_FLAG_KEY, "true", getCookieOptions());
          Cookies.set(POPUP_STATE_STORAGE_KEY, "true", getCookieOptions());

          if (connectionDetails) {
            const existing = Cookies.get(CONNECTION_DETAILS_KEY);
            if (!existing) {
              Cookies.set(
                CONNECTION_DETAILS_KEY,
                JSON.stringify(connectionDetails),
                getCookieOptions(),
              );
            }
          }

          console.log(
            "[IFRAME MODE] ✅ Cookies preserved for refresh - session will NOT be closed",
          );
        } catch (error) {
          console.warn(
            "[IFRAME MODE] Failed to preserve cookies on refresh:",
            error,
          );
        }
      } else {
        // Iframe being removed - close session
        console.log(
          "[IFRAME MODE] ❌ Iframe being removed (NOT refresh) - closing session",
        );

        isManualCloseRef.current = true;

        clearCookies();
        room.disconnect();
      }
    };

    const handleBeforeUnload = () => {
      if (!popupOpen) return;

      isManualCloseRef.current = false;
      try {
        Cookies.set(POPUP_STATE_STORAGE_KEY, "true", getCookieOptions());

        if (connectionDetails) {
          const existing = Cookies.get(CONNECTION_DETAILS_KEY);
          if (!existing) {
            Cookies.set(
              CONNECTION_DETAILS_KEY,
              JSON.stringify(connectionDetails),
              getCookieOptions(),
            );
          }
        }

        Cookies.set(IFRAME_REFRESH_FLAG_KEY, "true", getCookieOptions());

        console.log(
          "[IFRAME MODE] Page unloading, preserving cookies for reconnection",
        );
      } catch (error) {
        console.warn(
          "[IFRAME MODE] Failed to store popup state before unload:",
          error,
        );
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && popupOpen) {
        isManualCloseRef.current = false;
        try {
          Cookies.set(POPUP_STATE_STORAGE_KEY, "true", getCookieOptions());
          if (connectionDetails) {
            const existing = Cookies.get(CONNECTION_DETAILS_KEY);
            if (!existing) {
              Cookies.set(
                CONNECTION_DETAILS_KEY,
                JSON.stringify(connectionDetails),
                getCookieOptions(),
              );
            }
          }
        } catch (error) {
          console.warn(
            "[IFRAME MODE] Failed to preserve cookies on visibility change:",
            error,
          );
        }
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Listen for popup toggle request from parent (extension mode or script tag mode)
    const handleParentMessage = (event: MessageEvent) => {
      if (!event.data?.type) return;

      if (event.data.type === "lk-open-popup") {
        console.log("[IFRAME MODE] Received lk-open-popup message from parent");
        // Toggle popup: if open, close it; if closed, open it
        const newState = !popupOpen;
        console.log(`[IFRAME MODE] Toggling popup: ${popupOpen} → ${newState}`);
        isManualCloseRef.current = !newState; // Set to true only when closing
        setPopupOpen(newState);
      }
    };

    window.addEventListener("message", handleParentMessage);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("message", handleParentMessage);
      if (urlCheckInterval) {
        clearInterval(urlCheckInterval);
      }
    };
  }, [popupOpen, room, connectionDetails, isManualCloseRef, setPopupOpen]);
}

function clearCookies() {
  try {
    Cookies.remove(POPUP_STATE_STORAGE_KEY, getCookieOptions());
    Cookies.remove(CONNECTION_DETAILS_KEY, getCookieOptions());
    Cookies.remove(IFRAME_REFRESH_FLAG_KEY, getCookieOptions());
    console.log("[IFRAME MODE] Cookies cleared");
  } catch (error) {
    console.warn("[IFRAME MODE] Failed to clear cookies:", error);
  }
}
