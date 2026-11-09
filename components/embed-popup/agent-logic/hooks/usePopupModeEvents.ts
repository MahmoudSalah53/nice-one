/**
 * Popup Mode Events Hook
 * Handles event listeners for popup mode (non-iframe):
 * - beforeunload: Preserve cookies for reconnection
 * - visibilitychange: Preserve state when hidden
 */

import { useEffect } from "react";
import Cookies from "js-cookie";
import { POPUP_STATE_STORAGE_KEY } from "../config";
import { getCookieOptions } from "../utils";

interface UsePopupModeEventsOptions {
  popupOpen: boolean;
  isManualCloseRef: React.MutableRefObject<boolean>;
}

export function usePopupModeEvents({
  popupOpen,
  isManualCloseRef,
}: UsePopupModeEventsOptions) {
  useEffect(() => {
    const isIframeMode = typeof window !== "undefined" && window.__iframeMode;
    if (isIframeMode) {
      return;
    }

    const handleBeforeUnload = () => {
      if (popupOpen) {
        isManualCloseRef.current = false;
        try {
          Cookies.set(POPUP_STATE_STORAGE_KEY, "true", getCookieOptions());
          console.log(
            "[POPUP MODE] Page unloading (reload/navigation), preserving cookies for reconnection"
          );
        } catch (error) {
          console.warn(
            "[POPUP MODE] Failed to store popup state before unload:",
            error
          );
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && popupOpen) {
        isManualCloseRef.current = false;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [popupOpen, isManualCloseRef]);
}

