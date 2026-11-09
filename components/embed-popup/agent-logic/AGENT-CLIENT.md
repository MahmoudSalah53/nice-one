# Agent Client Architecture

## Overview

`agent-client.tsx` is the main voice agent component, refactored into modular hooks.

## Structure

```
embed-popup/
├── agent-client.tsx          # Main component (210 lines, was 1181)
├── agent-logic/
│   ├── config.ts             # Cookie keys & constants
│   ├── utils.ts              # Cookie helpers (getCookieOptions, isHeartbeatStale)
│   └── hooks/
│       ├── index.ts          # Re-exports all hooks
│       ├── useCookieState.ts # Cookie-based popup state
│       ├── useTabSync.ts     # Cross-tab heartbeat & takeover
│       ├── useRoomEvents.ts  # Room disconnect & media errors
│       ├── useRoomConnection.ts # Connect/disconnect logic
│       ├── usePopupToggle.ts # Popup open/close handling
│       ├── usePopupModeEvents.ts # beforeunload, visibilitychange
│       ├── useIframeModeEvents.ts # pagehide, parent URL monitor
│       ├── useDOMChangeDetection.ts # Mutation & URL change callbacks
│       └── useAgentDetection.ts # Agent join detection & DOM RPC
├── rpc-handlers.ts           # Incoming RPC handlers (agent→frontend)
└── rpc-senders.ts            # Outgoing RPC calls (frontend→agent)
```

## Hooks Summary

| Hook | Purpose |
|------|---------|
| `useCookieState` | Manages popup open/close state with cookie persistence |
| `useTabSync` | Heartbeat-based tab takeover (2s interval, 5s stale threshold) |
| `useRoomEvents` | Handles `Disconnected` and `MediaDevicesError` events |
| `useRoomConnection` | Connects to LiveKit room, enables mic |
| `usePopupToggle` | Toggle popup with animation lock |
| `usePopupModeEvents` | Preserves cookies on page reload (popup mode) |
| `useIframeModeEvents` | Handles iframe refresh vs removal detection |
| `useDOMChangeDetection` | Sets up DOM mutation callbacks |
| `useAgentDetection` | Sends initial DOM RPC when agent joins |

## Testing Checklist

### Basic Flow
- [ ] Open popup → connects to room
- [ ] Close popup → sends `close_session` RPC, disconnects
- [ ] Refresh page → popup auto-reopens, reconnects

### Cross-Tab
- [ ] Open popup in Tab A
- [ ] Open same page in Tab B → Tab B takes over, Tab A closes

### Iframe Mode
- [ ] Embed in iframe → works same as popup
- [ ] Refresh parent page → session preserved
- [ ] Remove iframe → session closes

### RPC Methods
Test each method via agent commands:
- `navigate`, `click_button`, `fill_input`
- `set_radio`, `set_checkbox`, `select_option`
- `open_mat_select`, `select_mat_option`
- `select_stations`, `set_trip_type_and_date`, `set_passengers`

## Config (config.ts)

```ts
POPUP_STATE_STORAGE_KEY = "livekit_popup_open"
CONNECTION_DETAILS_KEY = "livekit_connection_details"
ACTIVE_TAB_KEY = "livekit_active_tab"
HEARTBEAT_KEY = "livekit_heartbeat"
HEARTBEAT_STALE_THRESHOLD_MS = 5000
```

