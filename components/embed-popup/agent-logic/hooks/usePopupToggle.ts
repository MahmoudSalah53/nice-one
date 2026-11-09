/**
 * Popup Toggle Hook
 * Handles popup open/close logic with cookie management
 */

import { useRef, useCallback, useEffect } from "react";
import Cookies from "js-cookie";
import {
  POPUP_STATE_STORAGE_KEY,
  CONNECTION_DETAILS_KEY,
  HEARTBEAT_KEY,
  ACTIVE_TAB_KEY,
} from "../config";
import { getCookieOptions } from "../utils";

interface UsePopupToggleOptions {
  setPopupOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setError: (error: null) => void;
}

// Animation lock timeout - prevents isAnimating from getting stuck
const ANIMATION_LOCK_TIMEOUT_MS = 500;

export function usePopupToggle({
  setPopupOpen,
  setError,
}: UsePopupToggleOptions) {
  const isAnimating = useRef(false);
  const isManualClose = useRef(false);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  const handleTogglePopup = useCallback(() => {
    // Don't block on isAnimating - it's unreliable with regular divs
    // The original used motion.div with proper animation callbacks
    // Our div has no CSS transitions, so onTransitionEnd never fires reliably

    setError(null);
    setPopupOpen((open) => {
      const newState = !open;

      if (!newState) {
        isManualClose.current = true;
        console.log("[POPUP TOGGLE] Popup closed manually by user");

        try {
          Cookies.remove(POPUP_STATE_STORAGE_KEY, getCookieOptions());
          Cookies.remove(CONNECTION_DETAILS_KEY, getCookieOptions());
          Cookies.remove(HEARTBEAT_KEY, getCookieOptions());
          Cookies.remove(ACTIVE_TAB_KEY, getCookieOptions());
          console.log("[POPUP TOGGLE] Cookies cleared on manual close");
        } catch (error) {
          console.warn("[POPUP TOGGLE] Failed to clear cookies:", error);
        }
      } else {
        isManualClose.current = false;
        try {
          Cookies.set(
            POPUP_STATE_STORAGE_KEY,
            String(newState),
            getCookieOptions(),
          );
          console.log("[POPUP TOGGLE] Popup opened, state stored in cookies");
        } catch (error) {
          console.warn("[POPUP TOGGLE] Failed to store popup state:", error);
        }
      }
      return newState;
    });
  }, [setPopupOpen, setError]);

  const handlePanelAnimationStart = useCallback(() => {
    isAnimating.current = true;

    // Safety timeout to prevent isAnimating from getting stuck
    // This handles cases where onTransitionEnd doesn't fire
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }
    animationTimeoutRef.current = setTimeout(() => {
      isAnimating.current = false;
    }, ANIMATION_LOCK_TIMEOUT_MS);
  }, []);

  const handlePanelAnimationComplete = useCallback(() => {
    isAnimating.current = false;
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
  }, []);

  return {
    isManualCloseRef: isManualClose,
    handleTogglePopup,
    handlePanelAnimationStart,
    handlePanelAnimationComplete,
  };
}
