/**
 * DOM Change Detection Hook
 * Sets up callbacks for DOM mutations and URL changes:
 * - Change detection callback
 * - Added/Removed elements callback
 * - URL change callback
 * - Iframe DOM updates
 */

import { useEffect, useRef } from "react";
import { Room, RoomEvent } from "livekit-client";
import { setChangeDetectionCallback } from "@/utils/changeDetection";
import {
  setAddedOrRemovedCallback,
  setUrlChangeCallback,
} from "@/utils/regenAndDiff";
import { sendDOMElementsRPC } from "../../rpc-senders";

interface UseDOMChangeDetectionOptions {
  room: Room;
  popupOpen: boolean;
}

export function useDOMChangeDetection({
  room,
  popupOpen,
}: UseDOMChangeDetectionOptions) {
  const lastIframeDomHashRef = useRef<string>("");

  // Set up change detection callbacks
  useEffect(() => {
    if (!popupOpen) {
      setChangeDetectionCallback(null);
      return;
    }

    const updateCallback = () => {
      console.log("[DOM DETECTION] Updating change detection callback:", {
        popupOpen,
        roomState: room.state,
      });

      if (room.state === "connected") {
        console.log("[DOM DETECTION] Setting change detection callback");
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        setChangeDetectionCallback((_data) => {
          sendDOMElementsRPC({ room, forceRefresh: true });
        });

        console.log("[DOM DETECTION] Setting AddedOrRemovedDetection callback");
        setAddedOrRemovedCallback(() => {
          sendDOMElementsRPC({ room, forceRefresh: true });
        });

        console.log("[DOM DETECTION] Setting URL change callback");
        setUrlChangeCallback(() => {
          console.log(
            "[DOM DETECTION] URL changed, sending full dom_elements RPC"
          );
          sendDOMElementsRPC({ room });
        });
      } else {
        console.log(
          "[DOM DETECTION] Clearing callback - room.state:",
          room.state
        );
        setChangeDetectionCallback(null);
        setAddedOrRemovedCallback(null);
        setUrlChangeCallback(null);
      }
    };

    updateCallback();

    const handleConnectionStateChanged = () => {
      updateCallback();
    };

    room.on(RoomEvent.Connected, handleConnectionStateChanged);
    room.on(RoomEvent.Disconnected, handleConnectionStateChanged);

    return () => {
      room.off(RoomEvent.Connected, handleConnectionStateChanged);
      room.off(RoomEvent.Disconnected, handleConnectionStateChanged);
      console.log("[DOM DETECTION] Cleaning up change detection callback");
      setChangeDetectionCallback(null);
    };
  }, [room, popupOpen]);

  // Listen for iframe DOM updates (iframe mode only)
  useEffect(() => {
    if (!popupOpen) return;

    const isIframeMode = typeof window !== "undefined" && window.__iframeMode;
    if (!isIframeMode) return;

    const computeHash = (domData: unknown) => {
      if (!domData || typeof domData !== "object") return "";
      const data = domData as {
        url?: string | null;
        nIntr?: number;
        interactiveElements?: unknown[];
      };
      const base =
        (data.url || "") +
        "|" +
        (data.nIntr || 0) +
        "|" +
        JSON.stringify(data.interactiveElements || []);
      let hash = 0;
      for (let i = 0; i < base.length; i++) {
        hash = (hash * 31 + base.charCodeAt(i)) | 0;
      }
      return String(hash);
    };

    const handleIframeDOMUpdated = (event: Event) => {
      const customEvent = event as CustomEvent;
      const domData = customEvent.detail;

      console.log(
        "[DOM DETECTION] Iframe DOM updated:",
        domData?.nIntr,
        "elements, URL:",
        domData?.url
      );

      const sig = computeHash(domData);
      if (sig && sig === lastIframeDomHashRef.current) {
        console.log(
          "[DOM DETECTION] Skipping dom_elements RPC (duplicate iframe DOM signature)"
        );
        return;
      }
      lastIframeDomHashRef.current = sig;

      if (room.state === "connected") {
        console.log(
          "[DOM DETECTION] Sending dom_elements RPC after iframe DOM update"
        );
        sendDOMElementsRPC({ room, forceRefresh: false });
      }
    };

    window.addEventListener("iframe-dom-updated", handleIframeDOMUpdated);
    console.log("[DOM DETECTION] Listening for iframe-dom-updated events");

    return () => {
      window.removeEventListener("iframe-dom-updated", handleIframeDOMUpdated);
    };
  }, [room, popupOpen]);
}

