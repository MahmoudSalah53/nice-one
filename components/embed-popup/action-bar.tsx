"use client";

import * as React from "react";
import { Track } from "livekit-client";
import { BarVisualizer } from "@livekit/components-react";
import { ChatTextIcon } from "@phosphor-icons/react/dist/ssr";
import { ChatInput } from "@/components/livekit/chat/chat-input";
// import { DeviceSelect } from "@/components/livekit/device-select";
import { TrackToggle } from "@/components/livekit/track-toggle";
import { Toggle } from "@/components/ui/toggle";
import {
  UseAgentControlBarProps,
  useAgentControlBar,
} from "@/hooks/use-agent-control-bar";
import { AppConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface AgentControlBarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    UseAgentControlBarProps {
  capabilities: Pick<
    AppConfig,
    "supportsChatInput" | "supportsVideoInput" | "supportsScreenShare"
  >;
  onChatOpenChange?: (open: boolean) => void;
  onSendMessage?: (message: string) => Promise<void>;
  onDeviceError?: (error: { source: Track.Source; error: Error }) => void;
}

/**
 * A control bar specifically designed for voice assistant interfaces
 */
export function ActionBar({
  controls,
  saveUserChoices = true,
  capabilities,
  className,
  onSendMessage,
  onChatOpenChange,
  // onDeviceError,
  ...props
}: AgentControlBarProps) {
  const [chatOpen, setChatOpen] = React.useState(false);
  const [isSendingMessage, setIsSendingMessage] = React.useState(false);

  // Allow input even if agent is not available yet (for better UX)
  const isInputDisabled = !chatOpen || isSendingMessage;

  const {
    micTrackRef,
    visibleControls,
    // cameraToggle,
    microphoneToggle,
    // screenShareToggle,
    // handleAudioDeviceChange,
  } = useAgentControlBar({
    controls,
    saveUserChoices,
  });

  const handleSendMessage = async (message: string) => {
    setIsSendingMessage(true);
    try {
      await onSendMessage?.(message);
    } finally {
      setIsSendingMessage(false);
    }
  };

  React.useEffect(() => {
    onChatOpenChange?.(chatOpen);
  }, [chatOpen, onChatOpenChange]);

  // const onMicrophoneDeviceSelectError = (error: Error) => {
  //   onDeviceError?.({ source: Track.Source.Microphone, error });
  // };

  return (
    <div
      aria-label="Voice assistant controls"
      className={cn(
        "bg-background border-separator1 dark:border-separator1 relative z-20 mx-2 mb-2 flex flex-col rounded-[24px] border p-1 drop-shadow-md",
        className
      )}
      {...props}
    >
      {capabilities.supportsChatInput && (
        <div
          className={cn(
            "relative overflow-hidden transition-[height] duration-300 ease-out",
            chatOpen ? "h-[46px]" : "h-0"
          )}
        >
          <div
            className={cn(
              "flex h-9 w-full items-center transition-opacity duration-150 ease-linear px-2",
              chatOpen
                ? "opacity-100 delay-150"
                : "opacity-0 pointer-events-none"
            )}
          >
            <ChatInput
              onSend={handleSendMessage}
              disabled={isInputDisabled}
              className="w-full text-foreground bg-transparent"
            />
          </div>
          {chatOpen && (
            <hr className="border-bg2 absolute inset-x-0 bottom-0 my-1 w-full" />
          )}
        </div>
      )}

      <div className="flex flex-row justify-between">
        <div className="flex gap-1">
          {visibleControls.microphone && (
            <div className="flex items-center gap-0 rtl:flex-row-reverse">
              <TrackToggle
                variant="primary"
                source={Track.Source.Microphone}
                pressed={microphoneToggle.enabled}
                disabled={microphoneToggle.pending}
                onPressedChange={microphoneToggle.toggle}
                className="peer/track group/track relative w-auto pr-3 pl-3 has-[+_*]:rounded-r-none has-[+_*]:border-r-0 has-[+_*]:pr-2"
              >
                <BarVisualizer
                  barCount={3}
                  trackRef={micTrackRef}
                  options={{ minHeight: 5 }}
                  className="flex h-full w-auto items-center justify-center gap-0.5"
                >
                  <span
                    className={cn([
                      "h-full w-0.5 origin-center rounded-2xl",
                      "group-data-[state=on]/track:bg-fg1 group-data-[state=off]/track:bg-destructive-foreground",
                      "data-lk-muted:bg-muted",
                    ])}
                  ></span>
                </BarVisualizer>
              </TrackToggle>
              {/* <DeviceSelect
                size="sm"
                kind="audioinput"
                requestPermissions={false}
                onMediaDeviceError={onMicrophoneDeviceSelectError}
                onActiveDeviceChange={handleAudioDeviceChange}
                className={cn([
                  "pl-2",
                  "peer-data-[state=off]/track:text-destructive-foreground",
                  "hover:text-fg1 focus:text-fg1",
                  "hover:peer-data-[state=off]/track:text-destructive-foreground focus:peer-data-[state=off]/track:text-destructive-foreground",
                  "hidden rounded-l-none md:block",
                ])}
              /> */}
            </div>
          )}

          {/* {capabilities.supportsVideoInput && visibleControls.camera && (
            <TrackToggle
              variant="primary"
              source={Track.Source.Camera}
              pressed={cameraToggle.enabled}
              pending={cameraToggle.pending}
              disabled={cameraToggle.pending}
              onPressedChange={cameraToggle.toggle}
              className="relative w-auto"
            />
          )} */}
        </div>
        <div className="flex gap-1">
          {/* {capabilities.supportsScreenShare && visibleControls.screenShare && (
            <TrackToggle
              variant="secondary"
              source={Track.Source.ScreenShare}
              pressed={screenShareToggle.enabled}
              disabled={screenShareToggle.pending}
              onPressedChange={screenShareToggle.toggle}
              className="relative w-auto"
            />
          )} */}

          {(visibleControls.chat || capabilities.supportsChatInput) && (
            <Toggle
              variant="secondary"
              aria-label="Toggle chat"
              pressed={chatOpen}
              onPressedChange={setChatOpen}
              className="aspect-square h-full"
            >
              <ChatTextIcon weight="bold" />
            </Toggle>
          )}
        </div>
      </div>
    </div>
  );
}
