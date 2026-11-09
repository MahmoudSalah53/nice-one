/**
 * Chat persistence for session recovery on page reload.
 * Uses cookies (same as connection details) so chat persists across:
 * - Subdomains (e.g. www.nwc.com.sa → ebranch.nwc.com.sa)
 * - Leave domain and return
 */

import Cookies from "js-cookie";
import type { ReceivedChatMessage } from "@livekit/components-react";
import { getCookieOptions } from "@/components/embed-popup/agent-logic/utils";

const STORAGE_PREFIX = "livekit_chat_";
const MAX_STORED_ROOMS = 10;
const MAX_MESSAGES_PER_ROOM = 50;
const MAX_COOKIE_BYTES = 3500;
const COOKIE_EXPIRES_DAYS = 7;

interface SerializableMessage {
  id: string;
  timestamp: number;
  message: string;
  editTimestamp?: number;
  fromIdentity?: string;
  fromName?: string;
  isLocal?: boolean;
}

function serializeMessage(msg: ReceivedChatMessage): SerializableMessage {
  return {
    id: msg.id,
    timestamp: msg.timestamp,
    message: msg.message,
    editTimestamp: msg.editTimestamp,
    fromIdentity: msg.from?.identity,
    fromName: msg.from?.name,
    isLocal: msg.from?.isLocal,
  };
}

function deserializeMessage(s: SerializableMessage): ReceivedChatMessage {
  const from =
    s.fromIdentity !== undefined
      ? {
          identity: s.fromIdentity,
          name: s.fromName ?? s.fromIdentity,
          isLocal: s.isLocal ?? false,
        }
      : undefined;
  return {
    id: s.id,
    timestamp: s.timestamp,
    message: s.message,
    editTimestamp: s.editTimestamp,
    from: from as ReceivedChatMessage["from"],
  };
}

function getStorageKey(roomName: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(roomName)}`;
}

function truncateToFit(messages: SerializableMessage[]): SerializableMessage[] {
  if (messages.length === 0) return [];
  let json = JSON.stringify(messages);
  if (json.length <= MAX_COOKIE_BYTES) return messages;
  for (let n = messages.length - 1; n >= 1; n--) {
    const trimmed = messages.slice(-n);
    json = JSON.stringify(trimmed);
    if (json.length <= MAX_COOKIE_BYTES) return trimmed;
  }
  return messages.slice(-1);
}

export function saveChat(
  roomName: string,
  messages: ReceivedChatMessage[],
): void {
  if (typeof window === "undefined" || !roomName || messages.length === 0) {
    return;
  }
  try {
    const toStore = messages
      .slice(-MAX_MESSAGES_PER_ROOM)
      .map(serializeMessage);
    const trimmed = truncateToFit(toStore);
    const value = JSON.stringify(trimmed);
    Cookies.set(getStorageKey(roomName), value, {
      ...getCookieOptions(),
      expires: COOKIE_EXPIRES_DAYS,
    });
  } catch (e) {
    console.warn("[Chat Persistence] Failed to save:", e);
  }
}

export function loadChat(roomName: string): ReceivedChatMessage[] | null {
  if (typeof window === "undefined" || !roomName) {
    return null;
  }
  try {
    const raw = Cookies.get(getStorageKey(roomName));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SerializableMessage[];
    if (!Array.isArray(parsed)) return null;
    return parsed.map(deserializeMessage);
  } catch (e) {
    console.warn("[Chat Persistence] Failed to load:", e);
    return null;
  }
}

export function clearChatForRoom(roomName: string): void {
  if (typeof window === "undefined" || !roomName) return;
  try {
    Cookies.remove(getStorageKey(roomName), getCookieOptions());
  } catch {
    // ignore
  }
}

function getAllChatCookieKeys(): { key: string; room: string }[] {
  try {
    const raw = document.cookie || "";
    const result: { key: string; room: string }[] = [];
    raw.split(";").forEach((part) => {
      const eq = part.indexOf("=");
      if (eq < 0) return;
      const key = part.slice(0, eq).trim();
      if (key.startsWith(STORAGE_PREFIX)) {
        try {
          const room = decodeURIComponent(key.slice(STORAGE_PREFIX.length));
          result.push({ key, room });
        } catch {
          result.push({ key, room: key });
        }
      }
    });
    return result;
  } catch {
    return [];
  }
}

/**
 * Prune old room chats to avoid cookie bloat.
 * Keeps only the most recently used rooms.
 */
export function pruneOldChats(keepRoomNames: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    const entries: { key: string; room: string; time: number }[] = [];
    for (const { key, room } of getAllChatCookieKeys()) {
      if (keepRoomNames.has(room)) continue;
      try {
        const raw = Cookies.get(key);
        const parsed = raw ? JSON.parse(raw) : [];
        const lastTs =
          Array.isArray(parsed) && parsed.length > 0
            ? (parsed[parsed.length - 1] as { timestamp?: number })?.timestamp ??
              0
            : 0;
        entries.push({ key, room, time: lastTs });
      } catch {
        entries.push({ key, room, time: 0 });
      }
    }
    entries.sort((a, b) => b.time - a.time);
    const toRemove = entries.slice(MAX_STORED_ROOMS);
    const opts = getCookieOptions();
    toRemove.forEach(({ key }) => Cookies.remove(key, opts));
  } catch {
    // ignore
  }
}
