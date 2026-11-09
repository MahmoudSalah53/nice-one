/**
 * Cookie State Management Hook
 * Handles cookie-based state persistence:
 * - Clear stale cookies on mount
 * - Get initial popup state from cookies
 * - Auto-open popup from cookies
 */

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import {
  POPUP_STATE_STORAGE_KEY,
  CONNECTION_DETAILS_KEY,
  ACTIVE_TAB_KEY,
  HEARTBEAT_KEY,
} from "../config";
import { getCookieOptions, isHeartbeatStale } from "../utils";

/**
 * Clear stale cookies if heartbeat is stale (no active tab)
 * Should be called before getting initial state
 */
export function clearStaleCookies(): void {
  if (typeof window === "undefined") return;

  const hasCookies =
    Cookies.get(POPUP_STATE_STORAGE_KEY) || Cookies.get(CONNECTION_DETAILS_KEY);

  if (hasCookies && isHeartbeatStale()) {
    console.log(
      "[COOKIE STATE] Heartbeat stale (no active tab) - clearing stale cookies"
    );
    try {
      Cookies.remove(POPUP_STATE_STORAGE_KEY, getCookieOptions());
      Cookies.remove(CONNECTION_DETAILS_KEY, getCookieOptions());
      Cookies.remove(ACTIVE_TAB_KEY, getCookieOptions());
      Cookies.remove(HEARTBEAT_KEY, getCookieOptions());
    } catch (error) {
      console.warn("[COOKIE STATE] Failed to clear stale cookies:", error);
    }
  } else if (hasCookies) {
    console.log(
      "[COOKIE STATE] Heartbeat fresh (active tab exists) - takeover mode"
    );
  }
}

/**
 * Get initial popup state from cookies
 */
export function getInitialPopupState(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const stored = Cookies.get(POPUP_STATE_STORAGE_KEY);
    if (stored === "true") {
      const connDetails = Cookies.get(CONNECTION_DETAILS_KEY);
      if (connDetails) {
        console.log("[COOKIE STATE] Restoring popup state from cookies");
        return true;
      }
    }
  } catch (error) {
    console.warn("[COOKIE STATE] Error reading popup state:", error);
  }
  return false;
}

/**
 * Hook to manage popup state with cookie persistence
 */
export function useCookieState() {
  // Clear stale cookies before initializing state
  if (typeof window !== "undefined") {
    clearStaleCookies();
  }

  const [popupOpen, setPopupOpen] = useState(getInitialPopupState);

  // Auto-open popup on mount if cookies indicate it should be open
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = Cookies.get(POPUP_STATE_STORAGE_KEY);
      const connDetails = Cookies.get(CONNECTION_DETAILS_KEY);

      console.log("[COOKIE STATE] Checking cookies on mount:", {
        popupState: stored,
        hasConnectionDetails: !!connDetails,
        currentPopupOpen: popupOpen,
      });

      if (stored === "true" && connDetails && !popupOpen) {
        console.log(
          "[COOKIE STATE] Auto-opening popup from cookies (subdomain/tab switch)"
        );
        setPopupOpen(true);
      }
    } catch (error) {
      console.warn("[COOKIE STATE] Error checking cookies on mount:", error);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { popupOpen, setPopupOpen };
}

