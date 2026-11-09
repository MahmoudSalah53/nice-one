import { AnimatePresence, motion } from "motion/react";
import { useVoiceAssistant } from "@livekit/components-react";
import { Microphone, PhoneDisconnectIcon, XIcon } from "@phosphor-icons/react";
import { EmbedErrorDetails } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

const AnimatedButton = motion.create(Button);

interface TriggerProps {
  error: EmbedErrorDetails | null;
  popupOpen: boolean;
  onToggle: () => void;
  isIframeMode?: boolean;
}

export function Trigger({
  error = null,
  popupOpen,
  onToggle,
  isIframeMode = false,
}: TriggerProps) {
  const { state: agentState } = useVoiceAssistant();

  const isAgentConnecting =
    popupOpen && (agentState === "connecting" || agentState === "initializing");

  const isAgentConnected =
    popupOpen &&
    agentState !== "disconnected" &&
    agentState !== "connecting" &&
    agentState !== "initializing";

  return (
    <AnimatePresence>
      <AnimatedButton
        key="trigger-button"
        size="lg"
        initial={{
          scale: 0,
        }}
        animate={{
          scale: 1,
        }}
        exit={{ scale: 0 }}
        transition={{
          type: "spring",
          duration: 1,
          bounce: 0.2,
        }}
        onClick={onToggle}
        className={cn(
          "relative m-0 block size-12 border-0 p-0.5 outline-none drop-shadow-md",
          "scale-100 transition-[scale] duration-300 hover:scale-105 focus:scale-105",
          // Use pixels because the host page may override the root rem size.
          !isIframeMode && "fixed right-[16px] bottom-[53px] z-[99999]",
          isIframeMode && "fixed right-4 bottom-10 z-[99999]",
        )}
        style={
          !isIframeMode
            ? {
                position: "fixed",
                right: "16px",
                bottom: "53px",
                zIndex: 99999,
                border: "none",
              }
            : undefined
        }
      >
        {/* ring */}
        <motion.div
          className={cn(
            "absolute inset-0 z-10 rounded-full transition-colors",
            !popupOpen && "bg-neutral-300",
            !error &&
              isAgentConnecting &&
              "bg-neutral-300/30 animate-spin [background-image:conic-gradient(from_0deg,transparent_0%,transparent_30%,#737373_50%,transparent_70%,transparent_100%)]",
            (isAgentConnected || (error && popupOpen)) &&
              "bg-destructive-foreground",
          )}
        />
        {/* icon */}
        <div
          className={cn(
            "relative z-20 grid size-11 place-items-center rounded-full transition-colors",
            !popupOpen && "bg-white",
            !error && isAgentConnecting && "bg-bg1",
            (isAgentConnected || (error && popupOpen)) && "bg-destructive",
          )}
        >
          <AnimatePresence>
            {!popupOpen && (
              <motion.div
                key="microphone-icon"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: popupOpen ? 20 : -20 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              >
                <Microphone
                  size={20}
                  weight="bold"
                  className="size-5"
                  style={{ color: "#1f2937" }}
                />
              </motion.div>
            )}
            {(isAgentConnecting || (error && popupOpen)) && (
              <motion.div
                key="dismiss"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: popupOpen ? -20 : 20 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              >
                <XIcon
                  size={20}
                  weight="bold"
                  className={cn(
                    "text-fg0 size-5",
                    error && "text-destructive-foreground",
                  )}
                />
              </motion.div>
            )}
            {!error && isAgentConnected && (
              <motion.div
                key="disconnect"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: popupOpen ? -20 : 20 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              >
                <PhoneDisconnectIcon
                  size={20}
                  weight="bold"
                  className="text-destructive-foreground size-5"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </AnimatedButton>
    </AnimatePresence>
  );
}
