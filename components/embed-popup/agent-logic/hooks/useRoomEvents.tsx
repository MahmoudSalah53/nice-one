/**
 * Room Events Hook
 * Handles LiveKit room event subscriptions:
 * - Disconnected event
 * - MediaDevicesError event
 */

import { useEffect } from "react";
import { Room, RoomEvent } from "livekit-client";
import { EmbedErrorDetails } from "@/lib/types";

interface UseRoomEventsOptions {
  room: Room;
  popupOpen: boolean;
  isManualCloseRef: React.MutableRefObject<boolean>;
  setError: (error: EmbedErrorDetails | null) => void;
}

export function useRoomEvents({
  room,
  popupOpen,
  isManualCloseRef,
  setError,
}: UseRoomEventsOptions) {
  useEffect(() => {
    const onDisconnected = () => {
      if (isManualCloseRef.current) {
        console.log(
          "[ROOM EVENTS] Room disconnected due to manual close - cookies already cleared",
        );
        isManualCloseRef.current = false;
      } else {
        console.log(
          "[ROOM EVENTS] Room disconnected (page reload/unload) - cookies preserved for reconnection",
        );
      }
    };

    const onMediaDevicesError = (error: Error) => {
      const isMediaDevicesUnavailable =
        !navigator.mediaDevices ||
        error.message.includes("getUserMedia") ||
        error.message.includes("enumerateDevices");

      if (isMediaDevicesUnavailable && !window.isSecureContext) {
        setError({
          title: "Microphone access requires HTTPS",
          description: (
            <p>
              The microphone requires a secure connection (HTTPS) or localhost.
              The page is currently served over{" "}
              {window.location.protocol.slice(0, -1)}. Please use HTTPS to
              enable microphone functionality.
            </p>
          ),
        });
      } else {
        setError({
          title: "Encountered an error with your media devices",
          description: `${error.name}: ${error.message}`,
        });
      }
    };

    room.on(RoomEvent.MediaDevicesError, onMediaDevicesError);
    room.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.MediaDevicesError, onMediaDevicesError);
    };
  }, [room, popupOpen, isManualCloseRef, setError]);
}
