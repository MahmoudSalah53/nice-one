/**
 * Tab Synchronization Hook
 * Handles cross-subdomain tab sync with heartbeat mechanism
 * - Sets this tab as active (takeover mode)
 * - Updates heartbeat every 2 seconds
 * - Closes if another tab takes over
 */

import { useEffect, useRef } from "react";
import { Room } from "livekit-client";
import Cookies from "js-cookie";
import { ACTIVE_TAB_KEY, HEARTBEAT_KEY } from "../config";
import { getCookieOptions } from "../utils";

interface UseTabSyncOptions {
  popupOpen: boolean;
  room: Room;
  onTakeover: () => void;
}

export function useTabSync({ popupOpen, room, onTakeover }: UseTabSyncOptions) {
  const tabId = useRef(Math.random().toString(36).substring(2, 9));

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!popupOpen) return;

    // IMMEDIATELY set this tab as active (takeover) - before any checks
    Cookies.set(ACTIVE_TAB_KEY, tabId.current, getCookieOptions());
    // Set initial heartbeat
    Cookies.set(HEARTBEAT_KEY, String(Date.now()), getCookieOptions());
    console.log("[TAB SYNC] Tab takeover - set active tab:", tabId.current);

    // Poll to detect if ANOTHER tab takes over AND keep heartbeat alive
    const interval = setInterval(() => {
      // Update heartbeat to signal this tab is still active
      Cookies.set(HEARTBEAT_KEY, String(Date.now()), getCookieOptions());

      const activeTab = Cookies.get(ACTIVE_TAB_KEY);
      // Only close if a DIFFERENT tab took over (not us)
      if (activeTab && activeTab !== tabId.current) {
        console.log(
          "[TAB SYNC] Another tab took over, closing this one. Their ID:",
          activeTab,
          "Our ID:",
          tabId.current
        );
        onTakeover();
        room.disconnect();
      }
    }, 2000); // Update heartbeat every 2 seconds

    return () => clearInterval(interval);
  }, [popupOpen, room, onTakeover]);

  return { tabId: tabId.current };
}

