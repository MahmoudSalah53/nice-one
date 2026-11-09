/**
 * Agent Detection Hook
 * Handles agent join detection and sends initial DOM RPC:
 * - Detects when agent joins the room
 * - Sends DOM elements RPC with retry logic
 * - Shows error if agent doesn't join within timeout
 */

import { useEffect, useRef } from "react";
import { Room, RoomEvent } from "livekit-client";
import { EmbedErrorDetails } from "@/lib/types";
import { sendDOMElementsRPC } from "../../rpc-senders";

interface UseAgentDetectionOptions {
  room: Room;
  popupOpen: boolean;
  setError: (error: EmbedErrorDetails | null) => void;
}

export function useAgentDetection({
  room,
  popupOpen,
  setError,
}: UseAgentDetectionOptions) {
  const domRpcSent = useRef(false);

  // Send RPC when agent joins the room (with retry logic)
  useEffect(() => {
    if (!popupOpen) {
      domRpcSent.current = false;
      return;
    }

    let retryCount = 0;
    const maxRetries = 5;
    let retryTimeout: NodeJS.Timeout;
    let sendTimeout: NodeJS.Timeout;

    const checkAgentAndSendRPC = async () => {
      if (domRpcSent.current) {
        console.log("[AGENT DETECTION] DOM RPC already sent, skipping");
        return;
      }

      if (room.state !== "connected") {
        return;
      }

      const agentParticipant = Array.from(
        room.remoteParticipants.values(),
      ).find((p) => p.isAgent);

      if (agentParticipant) {
        domRpcSent.current = true;

        sendTimeout = setTimeout(async () => {
          try {
            await sendDOMElementsRPC({ room });
            console.log("[AGENT DETECTION] DOM elements RPC sent successfully");
          } catch (error) {
            console.error("[AGENT DETECTION] Error sending DOM RPC:", error);
            domRpcSent.current = false;
            if (retryCount < maxRetries) {
              retryCount++;
              retryTimeout = setTimeout(
                checkAgentAndSendRPC,
                1000 * retryCount,
              );
            }
          }
        }, 2000);
      } else {
        if (retryCount < maxRetries) {
          retryCount++;
          retryTimeout = setTimeout(checkAgentAndSendRPC, 1000 * retryCount);
        }
      }
    };

    if (room.state === "connected") {
      checkAgentAndSendRPC();
    }

    const handleConnected = () => {
      retryCount = 0;
      checkAgentAndSendRPC();
    };

    const handleParticipantConnected = () => {
      retryCount = 0;
      checkAgentAndSendRPC();
    };

    room.on(RoomEvent.Connected, handleConnected);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);

    return () => {
      room.off(RoomEvent.Connected, handleConnected);
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      if (retryTimeout) clearTimeout(retryTimeout);
      if (sendTimeout) clearTimeout(sendTimeout);
    };
  }, [room, popupOpen]);

  // Check if agent joins within timeout
  useEffect(() => {
    if (!popupOpen) return;

    const startAgentDetection = () => {
      if (room.state !== "connected") return;

      const checkAgentAvailable = () => {
        const agentParticipant = Array.from(
          room.remoteParticipants.values(),
        ).find((p) => p.isAgent);
        return !!agentParticipant;
      };

      const timeout = setTimeout(() => {
        if (!checkAgentAvailable()) {
          setError({
            title: "Session ended",
            description: (
              <p className="w-full">
                Agent did not join the room. Please wait a moment and try again.
              </p>
            ),
          });
        }
      }, 60_000);

      const checkInterval = setInterval(() => {
        if (checkAgentAvailable()) {
          setError(null);
          clearInterval(checkInterval);
          clearTimeout(timeout);
        }
      }, 1000);

      const handleParticipantConnected = () => {
        if (checkAgentAvailable()) {
          setError(null);
          clearInterval(checkInterval);
          clearTimeout(timeout);
          room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
        }
      };

      room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);

      return () => {
        clearTimeout(timeout);
        clearInterval(checkInterval);
        room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      };
    };

    let cleanup: (() => void) | undefined;
    if (room.state === "connected") {
      cleanup = startAgentDetection();
    }

    const handleConnected = () => {
      cleanup = startAgentDetection();
    };

    room.on(RoomEvent.Connected, handleConnected);

    return () => {
      room.off(RoomEvent.Connected, handleConnected);
      if (cleanup) cleanup();
    };
  }, [room, popupOpen, setError]);
}
