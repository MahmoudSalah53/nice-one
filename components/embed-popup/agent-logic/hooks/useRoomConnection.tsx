/**
 * Room Connection Hook
 * Handles LiveKit room connection and disconnection:
 * - Connect to room when popup opens
 * - Enable microphone
 * - Disconnect when popup closes
 * - Store popup state in cookies
 */

import { useEffect } from "react";
import { Room } from "livekit-client";
import Cookies from "js-cookie";
import { AppConfig, EmbedErrorDetails, ConnectionDetails } from "@/lib/types";
import { POPUP_STATE_STORAGE_KEY, ACTIVE_TAB_KEY } from "../config";
import { getCookieOptions } from "../utils";
import { sendCloseSessionRPC } from "../../rpc-senders";

interface UseRoomConnectionOptions {
  room: Room;
  popupOpen: boolean;
  appConfig: AppConfig;
  connectionDetails: ConnectionDetails | null;
  existingOrRefreshConnectionDetails: () => Promise<ConnectionDetails | null>;
  isManualCloseRef: React.MutableRefObject<boolean>;
  tabId: string;
  setError: (error: EmbedErrorDetails | null) => void;
}

export function useRoomConnection({
  room,
  popupOpen,
  appConfig,
  connectionDetails,
  existingOrRefreshConnectionDetails,
  isManualCloseRef,
  tabId,
  setError,
}: UseRoomConnectionOptions) {
  // Connect to room when popup opens
  useEffect(() => {
    if (!popupOpen) return;
    if (room.state !== "disconnected") return;

    const connect = async () => {
      try {
        console.log("[ROOM CONNECTION] Getting connection details...");
        const details = await existingOrRefreshConnectionDetails();

        if (!details) {
          console.log("[ROOM CONNECTION] Connection details not available:", {
            hasAppConfig: !!appConfig,
            sandboxId: appConfig?.sandboxId,
            agentName: appConfig?.agentName,
          });
          return;
        }

        console.log("[ROOM CONNECTION] Connecting to room:", details.roomName);

        await room.connect(details.serverUrl, details.participantToken);

        // Set this tab as active
        try {
          Cookies.set(ACTIVE_TAB_KEY, tabId, getCookieOptions());
          console.log("[ROOM CONNECTION] Set active tab cookie for takeover");
        } catch (error) {
          console.warn(
            "[ROOM CONNECTION] Failed to set active tab cookie:",
            error,
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Enable microphone
        if (
          navigator.mediaDevices &&
          typeof navigator.mediaDevices.getUserMedia === "function"
        ) {
          try {
            await room.localParticipant.setMicrophoneEnabled(true, undefined, {
              preConnectBuffer: appConfig.isPreConnectBufferEnabled,
            });
          } catch (micError) {
            console.warn(
              "[ROOM CONNECTION] Failed to enable microphone:",
              micError,
            );
          }
        } else {
          const protocol = window.location.protocol;
          console.warn(
            "[ROOM CONNECTION] Media devices not available. Protocol:",
            protocol,
          );
          setError({
            title: "Microphone access requires HTTPS",
            description: (
              <p>
                The microphone requires a secure connection (HTTPS) or
                localhost. The page is currently served over{" "}
                {protocol.slice(0, -1)}. Please use HTTPS or localhost to enable
                microphone functionality.
              </p>
            ),
          });
        }

        // Store popup state in cookies
        try {
          Cookies.set(POPUP_STATE_STORAGE_KEY, "true", getCookieOptions());
          console.log(
            "[ROOM CONNECTION] Connected, popup state stored in cookies",
          );
        } catch (error) {
          console.warn("[ROOM CONNECTION] Failed to store popup state:", error);
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error("[ROOM CONNECTION] Error connecting:", error);
          setError({
            title: "There was an error connecting to the agent",
            description: `${error.name}: ${error.message}`,
          });
        }
      }
    };

    connect();
  }, [
    room,
    popupOpen,
    connectionDetails,
    existingOrRefreshConnectionDetails,
    appConfig,
    tabId,
    setError,
  ]);

  // Disconnect when popup closes
  useEffect(() => {
    if (!popupOpen && room.state !== "disconnected") {
      if (document.visibilityState !== "hidden") {
        if (isManualCloseRef.current) {
          console.log(
            "[ROOM CONNECTION] Manual close - closing session and disconnecting",
          );
          sendCloseSessionRPC({ room })
            .then(() => {
              console.log(
                "[ROOM CONNECTION] Session close RPC sent, disconnecting",
              );
              room.disconnect();
            })
            .catch((error: unknown) => {
              console.warn(
                "[ROOM CONNECTION] Error sending close_session RPC:",
                error,
              );
              room.disconnect();
            });
        } else {
          console.log("[ROOM CONNECTION] Popup closed, disconnecting room");
          room.disconnect();
        }
      }
    }
  }, [popupOpen, room, isManualCloseRef]);
}
