/**
 * Agent Client Hooks
 * Re-exports all hooks for easy importing
 */

export { useTabSync } from "./useTabSync";
export { useRoomEvents } from "./useRoomEvents";
export { useRoomConnection } from "./useRoomConnection";
export { usePopupModeEvents } from "./usePopupModeEvents";
export { useIframeModeEvents } from "./useIframeModeEvents";
export { useDOMChangeDetection } from "./useDOMChangeDetection";
export { useAgentDetection } from "./useAgentDetection";
export { usePopupToggle } from "./usePopupToggle";
export {
  useCookieState,
  clearStaleCookies,
  getInitialPopupState,
} from "./useCookieState";

