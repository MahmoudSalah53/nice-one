import { useEffect } from "react";
import { Room, RoomEvent } from "livekit-client";

type RpcHandler = (data: { payload?: string | unknown }) => Promise<string>;

interface UseRpcMethodOptions {
  room: Room;
  popupOpen: boolean;
  methodName: string;
  handler: RpcHandler;
  logPrefix?: string;
}

/**
 * Generic hook to register an RPC method on the room's local participant.
 * Handles connection state, popup state, and automatic re-registration on reconnect.
 */
export function useRpcMethod({
  room,
  popupOpen,
  methodName,
  handler,
  logPrefix = `[${methodName.toUpperCase()} RPC]`,
}: UseRpcMethodOptions) {
  useEffect(() => {
    if (!popupOpen) {
      console.log(`${logPrefix} Popup not open, skipping registration`);
      return;
    }

    const registerRpc = () => {
      if (room.state !== "connected") {
        console.log(
          `${logPrefix} Room not connected (state: ${room.state}), cannot register`
        );
        return;
      }

      if (!room.localParticipant) {
        console.log(
          `${logPrefix} Local participant not available, cannot register`
        );
        return;
      }

      console.log(`${logPrefix} Registering ${methodName} RPC method...`);

      room.localParticipant.registerRpcMethod(methodName, handler);

      console.log(
        `${logPrefix} ✅ RPC method "${methodName}" registered successfully`
      );
    };

    // Try to register immediately if room is already connected
    registerRpc();

    // Listen for connection state changes to register when room connects
    const handleConnected = () => {
      console.log(
        `${logPrefix} Room connected, attempting to register RPC method...`
      );
      registerRpc();
    };

    room.on(RoomEvent.Connected, handleConnected);

    // Cleanup
    return () => {
      room.off(RoomEvent.Connected, handleConnected);
    };
  }, [room, popupOpen, methodName, handler, logPrefix]);
}
