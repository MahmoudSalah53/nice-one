"use client";

/**
 * Agent Client Component
 * Main entry point for the voice agent popup/iframe
 *
 * This component has been refactored to use modular hooks from:
 * @see ./agent-logic/hooks/
 */

import { useEffect, useMemo, useState } from "react";
import { Room, setLogLevel } from "livekit-client";

if (typeof window !== "undefined") {
  setLogLevel("error");
}
import {
  RoomAudioRenderer,
  RoomContext,
  StartAudio,
} from "@livekit/components-react";
import { ActionBar } from "@/components/embed-popup/action-bar";
import { ErrorMessage } from "@/components/embed-popup/error-message";
import { Trigger } from "@/components/embed-popup/trigger";
import useConnectionDetails from "@/hooks/use-connection-details";
import { type AppConfig, EmbedErrorDetails } from "@/lib/types";
import "@/utils/siteAutomation";
import "@/utils/interactiveDomSerializer";
import { useRpcMethod } from "@/hooks/use-rpc-method";
import { rpcHandlers } from "@/components/embed-popup/rpc-handlers";

declare global {
  interface Window {
    __popupOpen?: boolean;
  }
}

// Import modular hooks
import {
  useCookieState,
  useTabSync,
  useRoomEvents,
  useRoomConnection,
  usePopupModeEvents,
  useIframeModeEvents,
  useDOMChangeDetection,
  useAgentDetection,
  usePopupToggle,
} from "@/components/embed-popup/agent-logic/hooks";

export type EmbedFixedAgentClientProps = {
  appConfig: AppConfig;
};

function AgentClient({ appConfig }: EmbedFixedAgentClientProps) {
  const room = useMemo(() => new Room(), []);
  const [error, setError] = useState<EmbedErrorDetails | null>(null);

  // Cookie-based state management
  const { popupOpen, setPopupOpen } = useCookieState();

  // Expose popup state globally so iframe wrapper/resize logic can know if the agent is open
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__popupOpen = popupOpen;
    }
  }, [popupOpen]);

  // Popup toggle logic
  const {
    isManualCloseRef,
    handleTogglePopup,
    handlePanelAnimationStart,
    handlePanelAnimationComplete,
  } = usePopupToggle({ setPopupOpen, setError });

  // Connection details hook
  const {
    connectionDetails,
    error: connectionError,
    existingOrRefreshConnectionDetails,
  } = useConnectionDetails(appConfig);

  // Handle connection error
  useEffect(() => {
    if (connectionError) {
      setError({
        title: "Failed to connect to server",
        description: connectionError.message,
      });
    }
  }, [connectionError]);

  // Tab synchronization (heartbeat + takeover)
  const { tabId } = useTabSync({
    popupOpen,
    room,
    onTakeover: () => {
      isManualCloseRef.current = false;
      setPopupOpen(false);
    },
  });

  // Room events (disconnect, media errors)
  useRoomEvents({
    room,
    popupOpen,
    isManualCloseRef,
    setError,
  });

  // Room connection management
  useRoomConnection({
    room,
    popupOpen,
    appConfig,
    connectionDetails,
    existingOrRefreshConnectionDetails,
    isManualCloseRef,
    tabId,
    setError,
  });

  // Popup mode event listeners
  usePopupModeEvents({
    popupOpen,
    isManualCloseRef,
  });

  // Iframe mode event listeners
  useIframeModeEvents({
    popupOpen,
    room,
    connectionDetails,
    isManualCloseRef,
    setPopupOpen,
  });

  // DOM change detection
  useDOMChangeDetection({
    room,
    popupOpen,
  });

  // Agent detection and initial DOM RPC
  useAgentDetection({
    room,
    popupOpen,
    setError,
  });

  // Register RPC methods
  useRpcMethod({
    room,
    popupOpen,
    methodName: "navigate",
    handler: rpcHandlers.navigate,
  });

  useRpcMethod({
    room,
    popupOpen,
    methodName: "click_button",
    handler: rpcHandlers.click_button,
  });

  useRpcMethod({
    room,
    popupOpen,
    methodName: "fill_input",
    handler: rpcHandlers.fill_input,
  });

  useRpcMethod({
    room,
    popupOpen,
    methodName: "set_radio",
    handler: rpcHandlers.set_radio,
  });

  useRpcMethod({
    room,
    popupOpen,
    methodName: "set_checkbox",
    handler: rpcHandlers.set_checkbox,
  });

  useRpcMethod({
    room,
    popupOpen,
    methodName: "select_option",
    handler: rpcHandlers.select_option,
  });

  useRpcMethod({
    room,
    popupOpen,
    methodName: "open_mat_select",
    handler: rpcHandlers.open_mat_select,
  });

  useRpcMethod({
    room,
    popupOpen,
    methodName: "select_mat_option",
    handler: rpcHandlers.select_mat_option,
  });

  useRpcMethod({
    room,
    popupOpen,
    methodName: "fill_booking_form",
    handler: rpcHandlers.fill_booking_form,
  });

  useRpcMethod({
    room,
    popupOpen,
    methodName: "select_stations",
    handler: rpcHandlers.select_stations,
  });

  useRpcMethod({
    room,
    popupOpen,
    methodName: "set_trip_type_and_date",
    handler: rpcHandlers.set_trip_type_and_date,
  });

  useRpcMethod({
    room,
    popupOpen,
    methodName: "set_passengers",
    handler: rpcHandlers.set_passengers,
  });

  useRpcMethod({
    room,
    popupOpen,
    methodName: "add_to_cart",
    handler: rpcHandlers.add_to_cart,
  });

  useRpcMethod({
    room,
    popupOpen,
    methodName: "checkout",
    handler: rpcHandlers.checkout,
  });

  return (
    <RoomContext.Provider value={room}>
      <RoomAudioRenderer />
      <StartAudio label="Start Audio" />

      <Trigger
        error={error}
        popupOpen={popupOpen}
        onToggle={handleTogglePopup}
      />

      {popupOpen &&
        (() => {
          const fullWidth = !!error;
          return (
            <div
              // Use pixels because the host page may override the root rem size.
              className={`fixed right-[68px] bottom-[53px] z-[99999] flex flex-col ${fullWidth ? "w-[320px]" : "w-fit"}`}
              style={{
                position: "fixed",
                right: "68px",
                bottom: "53px",
                zIndex: 99999,
              }}
              onTransitionStart={handlePanelAnimationStart}
              onTransitionEnd={handlePanelAnimationComplete}
            >
              {error ? (
                <div className="bg-bg1 dark:bg-bg2 rounded-[24px] p-0 drop-shadow-md">
                  <ErrorMessage error={error} sandboxId={appConfig.sandboxId} />
                </div>
              ) : (
                <div className="mr-1 w-fit rounded-[24px] border border-neutral-200 bg-white drop-shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
                  <ActionBar
                    className="!m-0 !border-neutral-200 !bg-white !text-neutral-900"
                    controls={{ microphone: true, chat: false }}
                    capabilities={{
                      supportsChatInput: false,
                      supportsVideoInput: false,
                      supportsScreenShare: false,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })()}
    </RoomContext.Provider>
  );
}

export default AgentClient;
