/**
 * Outgoing RPC call functions (frontend → backend)
 * These functions send RPC calls to the backend agent
 */

import {
  serializerInstance,
  InteractiveElementNode,
  type DOMElementsJSON,
} from "../../utils/interactiveDomSerializer";
import { collectDOMSnapshot } from "../../utils/regenAndDiff";
import { Room } from "livekit-client";

// Extend Window for iframe bridge types
declare global {
  interface Window {
    __iframeDOMData: DOMElementsJSON | null;
    __iframeMode: boolean;
    __requestParentDOM: () => void;
  }
}

interface SendDOMElementsOptions {
  room: Room;
  retryCount?: number;
  maxRetries?: number;
  retryDelay?: number;
  rpcTimeout?: number;
  /**
   * When true we force a fresh DOM pull (clears iframe cache and resets js ids)
   */
  forceRefresh?: boolean;
}

// Maximum payload size in bytes
// Popup mode: 60KB (direct WebSocket connection allows larger payloads)
// Iframe mode: 14KB (RPC through postMessage has stricter limits)
function getMaxPayloadSize(): number {
  const isIframeMode = typeof window !== "undefined" && window.__iframeMode;
  return isIframeMode ? 14000 : 60000;
}

/**
 * Split large DOM elements array into chunks
 * Takes into account the metadata overhead that will be added to each chunk
 */
function splitIntoChunks(
  elements: InteractiveElementNode[],
  metadata: {
    ts: string;
    url: string | null;
    title: string | null;
    nIntr: number;
  },
  maxSize: number = getMaxPayloadSize()
): InteractiveElementNode[][] {
  const chunks: InteractiveElementNode[][] = [];
  let currentChunk: InteractiveElementNode[] = [];

  // Calculate metadata overhead (approximate size of metadata fields in each chunk)
  // This includes: ts, url, title, nIntr, totalChunks, chunkIndex
  const sampleMetadata = {
    ts: metadata.ts,
    url: metadata.url,
    title: metadata.title,
    nIntr: metadata.nIntr,
    totalChunks: 1,
    chunkIndex: 0,
    interactiveElements: [],
  };
  const metadataOverhead = new Blob([JSON.stringify(sampleMetadata)]).size;

  // Available size for elements (subtract metadata overhead and some buffer)
  const availableSize = maxSize - metadataOverhead - 500; // 500 bytes buffer

  let currentSize = 0;

  for (const element of elements) {
    const elementSize = new Blob([JSON.stringify(element)]).size;

    // If adding this element would exceed the limit, start a new chunk
    if (currentSize + elementSize > availableSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [element];
      currentSize = elementSize;
    } else {
      currentChunk.push(element);
      currentSize += elementSize;
    }
  }

  // Add the last chunk if it has elements
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Get DOM elements - handles both normal mode and iframe mode
 */
async function getDOMElements({
  forceRefresh = true,
}: {
  forceRefresh?: boolean;
} = {}): Promise<DOMElementsJSON | null> {
  // Check if running in iframe mode with bridge data
  const isIframeMode = typeof window !== "undefined" && window.__iframeMode;

  console.log("[DOM ELEMENTS] Mode check:", {
    iframeMode: isIframeMode,
    hasDOMData: !!window.__iframeDOMData,
    dataElements: window.__iframeDOMData?.nIntr,
  });

  if (isIframeMode) {
    // Always request a fresh DOM unless explicitly told not to
    if (forceRefresh) {
      window.__iframeDOMData = null;
    }

    console.log("[DOM ELEMENTS] Running in iframe mode");

    // Check if we already have DOM data from parent
    if (!forceRefresh && window.__iframeDOMData) {
      console.log(
        "[DOM ELEMENTS] ✅ Using cached iframe DOM data with",
        window.__iframeDOMData.nIntr,
        "elements"
      );
      return window.__iframeDOMData as DOMElementsJSON;
    }

    // Request DOM from parent and wait for it
    console.log("[DOM ELEMENTS] ⏳ Requesting DOM from parent...");
    window.__requestParentDOM?.();

    // Wait for DOM data with timeout
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds total

      const checkData = () => {
        if (window.__iframeDOMData) {
          console.log(
            "[DOM ELEMENTS] ✅ Received DOM data after",
            attempts * 100,
            "ms"
          );
          resolve(window.__iframeDOMData as DOMElementsJSON);
          return;
        }

        attempts++;
        if (attempts % 10 === 0) {
          console.log(
            "[DOM ELEMENTS] Still waiting for DOM data... (attempt",
            attempts,
            ")"
          );
          window.__requestParentDOM?.(); // Re-request periodically
        }

        if (attempts < maxAttempts) {
          setTimeout(checkData, 100);
        } else {
          console.warn("[DOM ELEMENTS] ❌ Timeout waiting for iframe DOM data");
          resolve(null);
        }
      };

      checkData();
    });
  }

  // Normal mode - use serializer directly
  console.log("[DOM ELEMENTS] Running in normal mode");

  if (
    !serializerInstance ||
    typeof serializerInstance.getInteractiveElementsAsJson !== "function"
  ) {
    console.error("[DOM ELEMENTS] InteractiveDomSerializer not available");
    return null;
  }

  const hostBody = window.document?.body;
  if (!hostBody) {
    console.error("[DOM ELEMENTS] Host page body not found");
    return null;
  }

  return collectDOMSnapshot();
}

/**
 * Send DOM elements JSON to the backend agent via RPC
 * Returns a promise that resolves when the RPC is successfully sent
 */
export async function sendDOMElementsRPC({
  room,
  retryCount = 0,
  maxRetries = 3,
  retryDelay = 2000,
  rpcTimeout = 15000, // Increased from 10000 to handle iframe mode latency
  forceRefresh = true,
}: SendDOMElementsOptions): Promise<void> {
  if (room.state !== "connected") {
    return;
  }

  const actualRetryDelay = retryDelay * (retryCount + 1); // Exponential backoff

  // Find the agent participant from room's remote participants
  const agentParticipant = Array.from(room.remoteParticipants.values()).find(
    (p) => p.isAgent
  );

  if (!agentParticipant) {
    if (retryCount < maxRetries) {
      console.log(
        `[DOM ELEMENTS RPC] Agent not found yet, retrying in ${actualRetryDelay / 1000}s (attempt ${retryCount + 1}/${maxRetries})`
      );
      await new Promise((resolve) => setTimeout(resolve, actualRetryDelay));
      return sendDOMElementsRPC({
        room,
        retryCount: retryCount + 1,
        maxRetries,
        retryDelay,
        rpcTimeout,
      });
    } else {
      console.warn(
        "[DOM ELEMENTS RPC] Agent not found in remote participants after",
        maxRetries,
        "retries"
      );
      return;
    }
  }

  try {
    console.log("[DOM ELEMENTS RPC] Getting interactive elements...");

    // Get DOM elements (handles both normal and iframe mode)
    const domElementsJson = await getDOMElements({ forceRefresh });

    if (!domElementsJson) {
      console.error("[DOM ELEMENTS RPC] Failed to get DOM elements");
      return;
    }

    if (!domElementsJson.nIntr || domElementsJson.nIntr === 0) {
      console.warn(
        "[DOM ELEMENTS RPC] No interactive elements found on the page"
      );
      console.warn(
        "[DOM ELEMENTS RPC] This might mean the page has no forms or interactive elements"
      );
    }

    // Log the full DOM data being sent to backend
    const payloadString = JSON.stringify(domElementsJson, null, 2);
    const payloadSize = new Blob([payloadString]).size;
    console.log("[DOM ELEMENTS RPC] Full DOM data being sent to backend:");
    console.log(domElementsJson);
    console.log("[DOM ELEMENTS RPC] Payload size:", payloadSize, "bytes");

    // Check if payload is too large and needs chunking (applies to both popup and iframe modes)
    const needsChunking = payloadSize > getMaxPayloadSize();

    if (needsChunking) {
      console.log(
        `[DOM ELEMENTS RPC] Payload too large (${payloadSize} bytes), splitting into chunks`
      );

      // Split interactive elements into chunks (with metadata overhead consideration)
      const chunks = splitIntoChunks(
        domElementsJson.interactiveElements || [],
        {
          ts: domElementsJson.ts,
          url: domElementsJson.url,
          title: domElementsJson.title,
          nIntr: domElementsJson.nIntr,
        }
      );
      console.log(`[DOM ELEMENTS RPC] Split into ${chunks.length} chunks`);

      // Display each chunk in console with its own DOM structure (same format as full DOM)
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        const chunkDOM = {
          ts: domElementsJson.ts,
          url: domElementsJson.url,
          title: domElementsJson.title,
          nIntr: chunk.length, // Number of elements in this chunk
          interactiveElements: chunk,
        };
        console.log(
          `[DOM ELEMENTS RPC] Chunk ${chunkIndex + 1}/${chunks.length} DOM:`,
          chunkDOM
        );
      }

      // Send each chunk as a separate RPC using the same "dom_elements" method
      for (let i = 0; i < chunks.length; i++) {
        // Check room state before sending each chunk
        if (room.state !== "connected") {
          console.warn(
            `[DOM ELEMENTS RPC] Room disconnected while sending chunks, stopped at chunk ${i + 1}/${chunks.length}`
          );
          return;
        }

        const chunk = chunks[i];
        // Each chunk has the same structure as the original payload
        const chunkPayload = {
          ts: domElementsJson.ts,
          url: domElementsJson.url,
          title: domElementsJson.title,
          nIntr: domElementsJson.nIntr,
          interactiveElements: chunk,
        };

        const chunkPayloadString = JSON.stringify(chunkPayload);
        const chunkSize = new Blob([chunkPayloadString]).size;
        console.log(
          `[DOM ELEMENTS RPC] Sending chunk ${i + 1}/${chunks.length} (${chunkSize} bytes, ${chunk.length} elements)`
        );

        try {
          await room.localParticipant.performRpc({
            destinationIdentity: agentParticipant.identity,
            method: "dom_elements",
            payload: chunkPayloadString,
            responseTimeout: rpcTimeout, // Use the same timeout as normal mode
          });
          console.log(
            `[DOM ELEMENTS RPC] ✅ Chunk ${i + 1}/${chunks.length} sent successfully`
          );
        } catch (error) {
          // Handle connection errors gracefully
          if (error instanceof Error && error.message.includes("closed")) {
            console.warn(
              `[DOM ELEMENTS RPC] Connection closed while sending chunk ${i + 1}, aborting`
            );
            return;
          }
          // Handle timeout errors - log and continue with next chunk
          if (
            error instanceof Error &&
            (error.message.includes("timeout") ||
              error.message.includes("Timeout"))
          ) {
            console.warn(
              `[DOM ELEMENTS RPC] ⚠️ Chunk ${i + 1}/${chunks.length} timed out, but may still be received by agent`
            );
            // Don't throw - the chunk might still be received, continue with next chunk
            continue;
          }
          throw error; // Re-throw other errors
        }

        // Small delay between chunks to avoid overwhelming the connection
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      console.log("[DOM ELEMENTS RPC] All chunks sent successfully");
      return;
    }

    // Perform RPC call to agent with DOM elements JSON (single payload for normal mode or small payloads)
    const rpcCallPromise = room.localParticipant.performRpc({
      destinationIdentity: agentParticipant.identity,
      method: "dom_elements",
      payload: payloadString,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("RPC timeout")), rpcTimeout);
    });

    try {
      const response = await Promise.race([rpcCallPromise, timeoutPromise]);
      console.log(
        "[DOM ELEMENTS RPC] Sent dom_elements RPC with",
        domElementsJson.nIntr || 0,
        "interactive elements"
      );
      console.log("[DOM ELEMENTS RPC] RPC Response:", response);
      return; // Success, no need to retry
    } catch (rpcError) {
      // If it's a timeout, retry if we haven't exceeded max retries
      if (
        rpcError instanceof Error &&
        (rpcError.message === "RPC timeout" ||
          rpcError.message.includes("timeout"))
      ) {
        if (retryCount < maxRetries) {
          console.warn(
            `[DOM ELEMENTS RPC] RPC call timed out, retrying in ${actualRetryDelay / 1000}s (attempt ${retryCount + 1}/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, actualRetryDelay));
          return sendDOMElementsRPC({
            room,
            retryCount: retryCount + 1,
            maxRetries,
            retryDelay,
            rpcTimeout,
          });
        } else {
          console.warn(
            "[DOM ELEMENTS RPC] RPC call timed out after",
            maxRetries,
            "retries"
          );
          console.warn(
            "[DOM ELEMENTS RPC] The RPC may still succeed in the background"
          );
          return; // Max retries reached, give up gracefully
        }
      } else {
        // Other errors - retry if possible
        if (retryCount < maxRetries) {
          console.warn(
            `[DOM ELEMENTS RPC] RPC call failed, retrying in ${actualRetryDelay / 1000}s (attempt ${retryCount + 1}/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, actualRetryDelay));
          return sendDOMElementsRPC({
            room,
            retryCount: retryCount + 1,
            maxRetries,
            retryDelay,
            rpcTimeout,
          });
        } else {
          throw rpcError; // Max retries reached, throw the error
        }
      }
    }
  } catch (error) {
    // Only log if we've exhausted all retries
    if (retryCount >= maxRetries) {
      console.error(
        "[DOM ELEMENTS RPC] Error sending DOM elements RPC call after",
        maxRetries,
        "retries:",
        error
      );
      console.error(
        "[DOM ELEMENTS RPC] Error details:",
        error instanceof Error ? error.message : String(error)
      );
      // Don't log stack trace for timeout errors as they're expected in some cases
      if (
        error instanceof Error &&
        error.stack &&
        !error.message.includes("timeout")
      ) {
        console.error("[DOM ELEMENTS RPC] Stack trace:", error.stack);
      }
    }
    throw error;
  }
}

interface ChangedInteractiveElementData {
  jsid: string;
  tag: string;
  type?: string | null;
  eventType: "click" | "change";
  value?: string | null;
  checked?: boolean | null;
  selectedOption?: string | null;
}

interface SendChangedInteractiveElementOptions {
  room: Room;
  data: ChangedInteractiveElementData;
  rpcTimeout?: number;
}

/**
 * Send changed interactive element data to the backend agent via RPC
 * Returns a promise that resolves when the RPC is successfully sent
 */
export async function sendChangedInteractiveElementRPC({
  room,
  data,
  rpcTimeout = 10000,
}: SendChangedInteractiveElementOptions): Promise<void> {
  if (room.state !== "connected") {
    console.log("[CHANGED ELEMENT RPC] Room not connected, skipping RPC send");
    return;
  }

  // Find the agent participant from room's remote participants
  const agentParticipant = Array.from(room.remoteParticipants.values()).find(
    (p) => p.isAgent
  );

  if (!agentParticipant) {
    console.warn(
      "[CHANGED ELEMENT RPC] Agent not found in remote participants"
    );
    return;
  }

  try {
    // Prepare payload - only include relevant properties based on element type
    const payload: ChangedInteractiveElementData = {
      jsid: data.jsid,
      tag: data.tag,
      eventType: data.eventType,
    };

    // Add type if present
    if (data.type !== null && data.type !== undefined) {
      payload.type = data.type;
    }

    // Add value for input and textarea elements (NOT for select)
    if (
      data.tag !== "select" &&
      data.value !== null &&
      data.value !== undefined
    ) {
      payload.value = data.value;
    }

    // Only add checked for checkbox and radio inputs
    if (
      data.tag === "input" &&
      (data.type === "checkbox" || data.type === "radio") &&
      data.checked !== null &&
      data.checked !== undefined
    ) {
      payload.checked = data.checked;
    }

    // Only add selectedOption for select and mat-select elements (contains the text, not value)
    if (
      (data.tag === "select" || data.tag === "mat-select") &&
      data.selectedOption !== null &&
      data.selectedOption !== undefined
    ) {
      payload.selectedOption = data.selectedOption;
    }

    console.log(
      "[CHANGED ELEMENT RPC] Sending changed interactive element:",
      payload
    );

    // Perform RPC call to agent
    const rpcCallPromise = room.localParticipant.performRpc({
      destinationIdentity: agentParticipant.identity,
      method: "changed_interactive_element",
      payload: JSON.stringify(payload),
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("RPC timeout")), rpcTimeout);
    });

    try {
      const response = await Promise.race([rpcCallPromise, timeoutPromise]);
      console.log(
        "[CHANGED ELEMENT RPC] Successfully sent changed_interactive_element RPC"
      );
      console.log("[CHANGED ELEMENT RPC] RPC Response:", response);
    } catch (rpcError) {
      console.warn(
        "[CHANGED ELEMENT RPC] Error sending RPC:",
        rpcError instanceof Error ? rpcError.message : String(rpcError)
      );
      // Don't throw - this is a fire-and-forget operation
    }
  } catch (error) {
    console.error(
      "[CHANGED ELEMENT RPC] Error preparing changed interactive element RPC:",
      error
    );
    // Don't throw - this is a fire-and-forget operation
  }
}

// new rpc method added_or_removed_interactive_elements

interface AddedOrRemovedInteractiveElementData {
  added: InteractiveElementNode[];
}

interface SendAddedOrRemovedInteractiveElementOptions {
  room: Room;
  data: AddedOrRemovedInteractiveElementData;
  rpcTimeout?: number;
}

/**
 * Send added or removed interactive element data to the backend agent via RPC
 * Returns a promise that resolves when the RPC is successfully sent
 */
export async function sendAddedOrRemovedInteractiveElementRPC({
  room,
  data,
  rpcTimeout = 10000,
}: SendAddedOrRemovedInteractiveElementOptions): Promise<void> {
  if (room.state !== "connected") {
    console.log(
      "[ADDED OR REMOVED ELEMENT RPC] Room not connected, skipping RPC send"
    );
    return;
  }

  // Find the agent participant from room's remote participants
  const agentParticipant = Array.from(room.remoteParticipants.values()).find(
    (p) => p.isAgent
  );

  if (!agentParticipant) {
    console.warn(
      "[ADDED OR REMOVED ELEMENT RPC] Agent not found in remote participants"
    );
    return;
  }

  try {
    // Prepare payload - only send added elements
    const payload: AddedOrRemovedInteractiveElementData = {
      added: data.added,
    };

    // Check payload size and split if needed (applies to both popup and iframe modes)
    const payloadString = JSON.stringify(payload);
    const payloadSize = new Blob([payloadString]).size;
    const needsChunking = payloadSize > getMaxPayloadSize();

    if (needsChunking) {
      console.log(
        `[ADDED OR REMOVED ELEMENT RPC] Payload too large (${payloadSize} bytes), splitting into chunks`
      );

      // Split added elements into chunks
      const metadata = {
        ts: new Date().toISOString(),
        url: typeof window !== "undefined" ? window.location.href : null,
        title: typeof document !== "undefined" ? document.title : null,
        nIntr: data.added.length,
      };
      const chunks = splitIntoChunks(data.added, metadata, getMaxPayloadSize());

      console.log(
        `[ADDED OR REMOVED ELEMENT RPC] Split into ${chunks.length} chunks`
      );

      // Send each chunk as a separate RPC
      for (let i = 0; i < chunks.length; i++) {
        // Check room state before sending each chunk
        if (room.state !== "connected") {
          console.warn(
            `[ADDED OR REMOVED ELEMENT RPC] Room disconnected while sending chunks, stopped at chunk ${i + 1}/${chunks.length}`
          );
          return;
        }

        const chunk = chunks[i];
        const chunkPayload: AddedOrRemovedInteractiveElementData = {
          added: chunk,
        };

        const chunkPayloadString = JSON.stringify(chunkPayload);
        const chunkSize = new Blob([chunkPayloadString]).size;

        console.log(
          `[ADDED OR REMOVED ELEMENT RPC] Sending chunk ${i + 1}/${chunks.length} (${chunkSize} bytes, ${chunk.length} elements)`
        );

        try {
          const rpcCallPromise = room.localParticipant.performRpc({
            destinationIdentity: agentParticipant.identity,
            method: "added_or_removed_interactive_elements",
            payload: chunkPayloadString,
          });

          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("RPC timeout")), rpcTimeout);
          });

          await Promise.race([rpcCallPromise, timeoutPromise]);
          console.log(
            `[ADDED OR REMOVED ELEMENT RPC] ✅ Chunk ${i + 1}/${chunks.length} sent successfully`
          );
        } catch (chunkError) {
          if (
            chunkError instanceof Error &&
            chunkError.message === "Connection closed"
          ) {
            console.warn(
              `[ADDED OR REMOVED ELEMENT RPC] Connection closed while sending chunk ${i + 1}, aborting`
            );
            return;
          }
          // Handle timeout errors - log and continue with next chunk
          if (
            chunkError instanceof Error &&
            chunkError.message === "RPC timeout"
          ) {
            console.warn(
              `[ADDED OR REMOVED ELEMENT RPC] ⚠️ Chunk ${i + 1}/${chunks.length} timed out, but may still be received by agent`
            );
            // Don't throw - the chunk might still be received, continue with next chunk
          } else {
            console.warn(
              `[ADDED OR REMOVED ELEMENT RPC] Error sending chunk ${i + 1}/${chunks.length}:`,
              chunkError instanceof Error
                ? chunkError.message
                : String(chunkError)
            );
          }
        }

        // Small delay between chunks to avoid overwhelming the connection
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      console.log(
        "[ADDED OR REMOVED ELEMENT RPC] All chunks sent successfully"
      );
      return;
    }

    // If payload is small enough, send normally
    console.log(
      "[ADDED OR REMOVED ELEMENT RPC] Sending added interactive elements:",
      payload
    );

    // Perform RPC call to agent
    const rpcCallPromise = room.localParticipant.performRpc({
      destinationIdentity: agentParticipant.identity,
      method: "added_or_removed_interactive_elements",
      payload: payloadString,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("RPC timeout")), rpcTimeout);
    });

    try {
      const response = await Promise.race([rpcCallPromise, timeoutPromise]);
      console.log(
        "[ADDED OR REMOVED ELEMENT RPC] Successfully sent added_or_removed_interactive_elements RPC"
      );
      console.log("[ADDED OR REMOVED ELEMENT RPC] RPC Response:", response);
    } catch (rpcError) {
      console.warn(
        "[ADDED OR REMOVED ELEMENT RPC] Error sending added_or_removed_interactive_elements RPC:",
        rpcError instanceof Error ? rpcError.message : String(rpcError)
      );
      // Don't throw - this is a fire-and-forget operation
    }
  } catch (error) {
    console.error(
      "[ADDED OR REMOVED ELEMENT RPC] Error preparing added_or_removed_interactive_elements RPC:",
      error
    );
    // Don't throw - this is a fire-and-forget operation
  }
}

/**
 * Send close_session RPC to backend to explicitly close the agent session
 * This is called when the user manually closes the popup
 */
export async function sendCloseSessionRPC({
  room,
  rpcTimeout = 5000,
}: {
  room: Room;
  rpcTimeout?: number;
}): Promise<void> {
  if (room.state !== "connected") {
    console.log("[CLOSE SESSION RPC] Room not connected, skipping RPC send");
    return;
  }

  // Find the agent participant from room's remote participants
  const agentParticipant = Array.from(room.remoteParticipants.values()).find(
    (p) => p.isAgent
  );

  if (!agentParticipant) {
    console.warn("[CLOSE SESSION RPC] Agent not found in remote participants");
    return;
  }

  try {
    console.log("[CLOSE SESSION RPC] Sending close_session RPC to backend");

    // Perform RPC call to agent
    const rpcCallPromise = room.localParticipant.performRpc({
      destinationIdentity: agentParticipant.identity,
      method: "close_session",
      payload: JSON.stringify({}),
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("RPC timeout")), rpcTimeout);
    });

    try {
      const response = await Promise.race([rpcCallPromise, timeoutPromise]);
      console.log("[CLOSE SESSION RPC] Successfully sent close_session RPC");
      console.log("[CLOSE SESSION RPC] RPC Response:", response);
    } catch (rpcError) {
      console.warn(
        "[CLOSE SESSION RPC] Error sending RPC:",
        rpcError instanceof Error ? rpcError.message : String(rpcError)
      );
      // Don't throw - we'll still disconnect even if RPC fails
    }
  } catch (error) {
    console.error(
      "[CLOSE SESSION RPC] Error preparing close_session RPC:",
      error
    );
    // Don't throw - we'll still disconnect even if RPC fails
  }
}
