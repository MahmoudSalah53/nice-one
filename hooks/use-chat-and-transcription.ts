import { useEffect, useMemo, useRef, useState } from "react";
import {
  type ReceivedChatMessage,
  type TextStreamData,
  useChat,
  useRoomContext,
  useTranscriptions,
} from "@livekit/components-react";
import {
  loadChat,
  saveChat,
  pruneOldChats,
} from "@/lib/chatPersistence";
import { transcriptionToChatMessage } from "@/lib/utils";

export default function useChatAndTranscription() {
  const transcriptions: TextStreamData[] = useTranscriptions();
  const chat = useChat();
  const room = useRoomContext();
  const [restoredMessages, setRestoredMessages] = useState<
    ReceivedChatMessage[]
  >([]);
  const restoredForRoomRef = useRef<string | null>(null);

  const liveMerged = useMemo(() => {
    // Deduplicate transcriptions by stream ID, keeping only the latest (final) message
    const transcriptionMap = new Map<string, ReceivedChatMessage>();

    transcriptions.forEach((transcription) => {
      const chatMessage = transcriptionToChatMessage(transcription, room);
      const streamId = chatMessage.id;
      const existing = transcriptionMap.get(streamId);

      if (!existing || chatMessage.timestamp >= existing.timestamp) {
        transcriptionMap.set(streamId, chatMessage);
      }
    });

    const merged: Array<ReceivedChatMessage> = [
      ...Array.from(transcriptionMap.values()),
      ...chat.chatMessages,
    ];
    return merged.sort((a, b) => a.timestamp - b.timestamp);
  }, [transcriptions, chat.chatMessages, room]);

  // Load persisted messages when room connects (reload scenario)
  useEffect(() => {
    const roomName = room.name;
    if (
      typeof roomName !== "string" ||
      roomName === "" ||
      room.state !== "connected"
    ) {
      return;
    }
    if (restoredForRoomRef.current === roomName) {
      return;
    }
    restoredForRoomRef.current = roomName;
    const loaded = loadChat(roomName);
    if (loaded && loaded.length > 0) {
      setRestoredMessages(loaded);
    } else {
      setRestoredMessages([]);
    }
  }, [room.name, room.state]);

  // Reset restored when room disconnects (new session will load fresh)
  useEffect(() => {
    if (room.state === "disconnected") {
      restoredForRoomRef.current = null;
      setRestoredMessages([]);
    }
  }, [room.state]);

  // Merge restored + live, dedupe by id
  const messages = useMemo(() => {
    const liveIds = new Set(liveMerged.map((m) => m.id));
    const fromRestored = restoredMessages.filter((m) => !liveIds.has(m.id));
    const merged: ReceivedChatMessage[] = [...fromRestored, ...liveMerged];
    return merged.sort((a, b) => a.timestamp - b.timestamp);
  }, [restoredMessages, liveMerged]);

  // Persist when messages change (room must be connected)
  useEffect(() => {
    const roomName = room.name;
    if (
      typeof roomName !== "string" ||
      roomName === "" ||
      room.state !== "connected" ||
      messages.length === 0
    ) {
      return;
    }
    saveChat(roomName, messages);
    pruneOldChats(new Set([roomName]));
  }, [room.name, room.state, messages]);

  return { messages, send: chat.send };
}
