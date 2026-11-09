import { type ClassValue, clsx } from "clsx";
import { Room } from "livekit-client";
import { twMerge } from "tailwind-merge";
import {
  type ReceivedChatMessage,
  type TextStreamData,
} from "@livekit/components-react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function transcriptionToChatMessage(
  textStream: TextStreamData,
  room: Room,
): ReceivedChatMessage {
  return {
    id: textStream.streamInfo.id,
    timestamp: textStream.streamInfo.timestamp,
    message: textStream.text,
    from:
      textStream.participantInfo.identity === room.localParticipant.identity
        ? room.localParticipant
        : Array.from(room.remoteParticipants.values()).find(
            (p) => p.identity === textStream.participantInfo.identity,
          ),
  };
}

/**
 * Filters chat messages to remove:
 * - Special characters (except question mark ? and ؟)
 * - English letters (A-Z, a-z)
 * Keeps only Arabic text, numbers, spaces, and question marks
 */
// export function filterChatMessage(message: string): string {
//   if (!message) return '';
  
//   // Remove English letters (A-Z, a-z)
//   let filtered = message.replace(/[A-Za-z]/g, '');
  
//   // Keep only Arabic characters, numbers, spaces, and question marks
//   // Arabic Unicode ranges: \u0600-\u06FF \u0750-\u077F \u08A0-\u08FF \uFB50-\uFDFF \uFE70-\uFEFF
//   // Question marks: ? (\u003F) and ؟ (\u061F)
//   filtered = filtered.replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF0-9\u0020\u003F\u061F]/g, '');
  
//   // Trim extra spaces
//   filtered = filtered.replace(/\s+/g, ' ').trim();
  
//   return filtered;
// }