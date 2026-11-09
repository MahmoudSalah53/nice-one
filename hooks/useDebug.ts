import * as React from "react";
import { LogLevel, setLogLevel } from "livekit-client";
import { useRoomContext } from "@livekit/components-react";

export const useDebugMode = ({ logLevel }: { logLevel?: LogLevel } = {}) => {
  const room = useRoomContext();

  React.useEffect(() => {
    // Default to "error" to minimize console noise - only show errors
    // Set logLevel to "debug" or "warn" explicitly if you need more detailed logging
    setLogLevel(logLevel ?? "error");

    // @ts-expect-error - window.__lk_room is a debug property not in Window type definition
    window.__lk_room = room;

    return () => {
      // @ts-expect-error - window.__lk_room is a debug property not in Window type definition
      window.__lk_room = undefined;
    };
  }, [room, logLevel]);
};
