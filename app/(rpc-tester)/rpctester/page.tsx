"use client";

import { useState, useEffect, useRef } from "react";
import {
  Room,
  RoomEvent,
  Participant,
  RemoteParticipant,
} from "livekit-client";

interface LogEntry {
  timestamp: Date;
  type: "info" | "success" | "error" | "warning" | "rpc-request" | "rpc-response";
  message: string;
}

type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantIdentity: string;
  participantToken: string;
  existingParticipantIdentities?: string[];
};

export default function RpcTesterPage() {
  const [currentRoomName, setCurrentRoomName] = useState<string>("");
  const [, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<Map<string, Participant>>(
    new Map()
  );
  const [localIdentity, setLocalIdentity] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);

  const [rpcDestination, setRpcDestination] = useState("");
  const [rpcMethod, setRpcMethod] = useState("");
  const [rpcPayload, setRpcPayload] = useState("");
  const [rpcResponse, setRpcResponse] = useState<string | null>(null);
  const [rpcError, setRpcError] = useState<string | null>(null);

  const [logs, setLogs] = useState<LogEntry[]>([]);

  const roomRef = useRef<Room | null>(null);

  const addLog = (type: LogEntry["type"], message: string) => {
    const entry: LogEntry = {
      timestamp: new Date(),
      type,
      message,
    };
    setLogs((prev) => [...prev, entry]);
  };

  const fetchConnectionDetails = async (): Promise<ConnectionDetails> => {
    const resp = await fetch("/api/rpctester/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!resp.ok) {
      const data = await resp.json();
      throw new Error(data.error || `Failed to get connection details (${resp.status})`);
    }

    return (await resp.json()) as ConnectionDetails;
  };

  const refreshParticipants = (currentRoom: Room) => {
    const newParticipants = new Map<string, Participant>();

    // Add local participant
    if (currentRoom.localParticipant) {
      newParticipants.set(
        currentRoom.localParticipant.identity,
        currentRoom.localParticipant
      );
      setLocalIdentity(currentRoom.localParticipant.identity);
    }

    // Add remote participants
    currentRoom.remoteParticipants.forEach((participant) => {
      newParticipants.set(participant.identity, participant);
    });

    setParticipants(newParticipants);
  };

  const connect = async () => {
    setIsConnecting(true);
    addLog("info", "Using credentials from server environment...");

    try {
      addLog(
        "info",
        "Searching for an existing room with agent + client (>= 2 participants)..."
      );
      const details = await fetchConnectionDetails();
      setCurrentRoomName(details.roomName);
      addLog(
        "info",
        `Selected room: ${details.roomName} (existing: ${(details.existingParticipantIdentities ?? []).join(", ") || "unknown"})`
      );
      await connectToRoom(
        details.serverUrl,
        details.participantToken,
        details.roomName
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      addLog("error", `Connection failed: ${errorMessage}`);
      setIsConnected(false);
      setIsConnecting(false);
      setRoom(null);
      roomRef.current = null;
    }
  };

  const connectToRoom = async (
    serverUrl: string,
    token: string,
    roomName: string
  ) => {
    try {
      // Create room instance
      const newRoom = new Room();
      roomRef.current = newRoom;
      setRoom(newRoom);

      // Set up event listeners
      newRoom.on(RoomEvent.Connected, () => {
        setIsConnected(true);
        setIsConnecting(false);
        addLog("success", `Connected to room: ${roomName}`);
        refreshParticipants(newRoom);
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
        setIsConnecting(false);
        addLog("warning", "Disconnected from LiveKit room");
        setParticipants(new Map());
        setLocalIdentity("");
      });

      newRoom.on(
        RoomEvent.ParticipantConnected,
        (participant: RemoteParticipant) => {
          addLog("info", `Participant connected: ${participant.identity}`);
          refreshParticipants(newRoom);
        }
      );

      newRoom.on(
        RoomEvent.ParticipantDisconnected,
        (participant: RemoteParticipant) => {
          addLog("info", `Participant disconnected: ${participant.identity}`);
          refreshParticipants(newRoom);
        }
      );

      // Listen for RPC responses
      newRoom.on(
        RoomEvent.DataReceived,
        (payload: Uint8Array, participant?: RemoteParticipant) => {
          try {
            const decoder = new TextDecoder();
            const text = decoder.decode(payload);
            addLog(
              "rpc-response",
              `RPC Response from ${participant?.identity || "unknown"}: ${text}`
            );
          } catch {
            addLog("rpc-response", `RPC Response (binary): ${payload.length} bytes`);
          }
        }
      );

      addLog("info", `Connecting to ${serverUrl}...`);
      await newRoom.connect(serverUrl, token);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      addLog("error", `Connection failed: ${errorMessage}`);
      setIsConnected(false);
      setIsConnecting(false);
      setRoom(null);
      roomRef.current = null;
    }
  };

  const disconnect = async () => {
    if (roomRef.current) {
      // Send close_session RPC before disconnecting
      if (roomRef.current.state === "connected") {
        // Find the agent participant
        const agentParticipant = Array.from(
          roomRef.current.remoteParticipants.values()
        ).find((p) => p.isAgent);

        if (agentParticipant) {
          try {
            addLog("info", "Sending close_session RPC to agent...");
            
            const rpcCallPromise = roomRef.current.localParticipant.performRpc({
              destinationIdentity: agentParticipant.identity,
              method: "close_session",
              payload: JSON.stringify({}),
            });

            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error("RPC timeout")), 5000);
            });

            try {
              await Promise.race([rpcCallPromise, timeoutPromise]);
              addLog("success", "close_session RPC sent successfully");
            } catch (rpcError) {
              const errorMessage =
                rpcError instanceof Error ? rpcError.message : "Unknown error";
              addLog("warning", `close_session RPC failed: ${errorMessage}`);
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error occurred";
            addLog("warning", `Error preparing close_session RPC: ${errorMessage}`);
          }
        } else {
          addLog("info", "No agent found, skipping close_session RPC");
        }
      }

      try {
        await roomRef.current.disconnect();
        addLog("info", "Disconnected from room");
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        addLog("error", `Disconnect error: ${errorMessage}`);
      }
      roomRef.current = null;
      setRoom(null);
      setIsConnected(false);
      setParticipants(new Map());
      setLocalIdentity("");
    }
  };

  const sendRpc = async () => {
    if (!roomRef.current || !isConnected) {
      addLog("error", "Not connected to a room");
      return;
    }

    if (!rpcDestination || !rpcMethod) {
      addLog("error", "Destination identity and method name are required");
      return;
    }

    // Validate destination exists
    if (!participants.has(rpcDestination)) {
      addLog(
        "warning",
        `Warning: Destination "${rpcDestination}" not found in participants list`
      );
    }

    // Store payload size for error reporting (declare outside try block)
    let finalPayloadSize = 0;

    try {
      setRpcResponse(null);
      setRpcError(null);

      // Convert payload to STRING for LiveKit RPC
      // LiveKit RPC expects string payloads, not Uint8Array
      let payload: string;
      if (rpcPayload.trim()) {
        try {
          // Try to parse as JSON and re-stringify to ensure valid JSON
          const parsed = JSON.parse(rpcPayload);
          payload = JSON.stringify(parsed);
        } catch {
          // If not valid JSON, use as string
          payload = rpcPayload;
        }
      } else {
        // Use empty string
        payload = "";
      }

      // Check payload size (LiveKit RPC limit is 15KB)
      const payloadSize = new Blob([payload]).size;
      if (payloadSize > 15360) {
        addLog(
          "error",
          `Payload size is ${Math.round(payloadSize / 1024)}KB - exceeds LiveKit's 15KB limit!`
        );
        setRpcError(
          `Payload too large: ${Math.round(payloadSize / 1024)}KB. LiveKit RPC limit is 15KB.`
        );
        return;
      } else if (payloadSize > 14000) {
        addLog(
          "warning",
          `Payload size is ${Math.round(payloadSize / 1024)}KB - approaching 15KB limit`
        );
      }

      addLog(
        "rpc-request",
        `Sending RPC to ${rpcDestination}: ${rpcMethod} (${Math.round(payloadSize / 1024)}KB)`
      );

      // Validate inputs before sending
      if (!rpcMethod || rpcMethod.trim().length === 0) {
        throw new Error("Method name cannot be empty");
      }
      if (!rpcDestination || rpcDestination.trim().length === 0) {
        throw new Error("Destination identity cannot be empty");
      }

      // Ensure payload is valid (not null/undefined)
      const finalPayload = payload || "";

      // Store payload size for error reporting
      finalPayloadSize = finalPayload.length;

      // Debug: Check if performRpc exists
      if (!roomRef.current.localParticipant.performRpc) {
        throw new Error(
          "performRpc method does not exist on LocalParticipant. This might be a LiveKit version issue."
        );
      }

      // Debug: Log what we're about to send
      console.log("About to call performRpc:", {
        destination: rpcDestination.trim(),
        method: rpcMethod.trim(),
        payloadType: typeof finalPayload,
        payloadLength: finalPayload.length,
        payloadPreview: finalPayload.substring(0, 100),
      });

      // Try both API signatures - LiveKit might use different formats
      let response;

      try {
        // Try object-based API first (newer API style)
        console.log("Trying object-based API...");
        response = await (
          roomRef.current!.localParticipant.performRpc as unknown as (
            opts: Record<string, unknown>
          ) => Promise<unknown>
        )({
          destinationIdentity: rpcDestination.trim(),
          method: rpcMethod.trim(),
          payload: finalPayload,
        });
      } catch (firstError) {
        console.log("Object-based API failed, trying positional parameters...");
        console.error("First attempt error:", firstError);

        // Fallback: try positional parameters (older API style)
        response = await (
          roomRef.current!.localParticipant.performRpc as unknown as (
            dest: string,
            method: string,
            payload: string
          ) => Promise<unknown>
        )(rpcDestination.trim(), rpcMethod.trim(), finalPayload);
      }

      // Handle response - response can be string, Uint8Array, or other types
      if (response instanceof Uint8Array) {
        try {
          const decoder = new TextDecoder();
          const text = decoder.decode(response);
          // Try to parse as JSON for pretty display
          try {
            const json = JSON.parse(text);
            setRpcResponse(JSON.stringify(json, null, 2));
          } catch {
            setRpcResponse(text);
          }
        } catch {
          setRpcResponse(`Binary response: ${response.length} bytes`);
        }
      } else if (typeof response === "string") {
        try {
          // Try to parse as JSON for pretty display
          const json = JSON.parse(response);
          setRpcResponse(JSON.stringify(json, null, 2));
        } catch {
          setRpcResponse(response);
        }
      } else {
        setRpcResponse(JSON.stringify(response, null, 2));
      }

      addLog("rpc-response", `RPC Response received from ${rpcDestination}`);
    } catch (error) {
      let errorMessage = "Unknown error occurred";
      let errorDetails = "";

      if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails = error.stack || "";

        // Include detailed error info in console
        console.error("=== RPC Error Caught ===");
        console.error("Error Message:", error.message);
        console.error("Error Name:", error.name);
        console.error("Error Stack:", error.stack);
        console.error("Destination:", rpcDestination);
        console.error("Method:", rpcMethod);
        console.error("Payload Size:", finalPayloadSize);
        console.error("Full Error Object:", error);
        console.error("========================");
      } else if (typeof error === "string") {
        errorMessage = error;
        console.error("String error caught:", error);
      } else {
        errorMessage = JSON.stringify(error);
        console.error("Non-Error object caught:", error);
      }

      const troubleshooting = `
=== RPC ERROR ===

${errorMessage}

${errorDetails ? `Stack Trace:\n${errorDetails}\n\n` : ""}
Common Causes:
1. RPC Handler Not Registered: The method "${rpcMethod}" must be registered on the agent/server using:
   room.registerRpcMethod("${rpcMethod}", handler)

2. Destination Not Ready: The participant "${rpcDestination}" may not be fully connected or doesn't support RPC.

3. Server-Side Issue: Check your agent/server logs for errors.

4. Method Name Mismatch: Ensure the method name matches exactly (case-sensitive).

Troubleshooting:
- Verify the agent has registered the RPC handler
- Check server/agent console logs
- Ensure the agent is connected (check Participants panel)
- Try a different method name if testing
`;
      setRpcError(troubleshooting);
      addLog("error", `RPC Error: ${errorMessage}`);
    }
  };

  // Global error handler for unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("=== Unhandled Promise Rejection ===");
      console.error("Reason:", event.reason);
      console.error("Promise:", event.promise);

      // Check if this is an RPC-related error
      if (event.reason && typeof event.reason === "object") {
        const errorStr = event.reason.toString();
        if (
          errorStr.includes("RPC") ||
          errorStr.includes("protobuf") ||
          errorStr.includes("writeScalar")
        ) {
          console.error("This appears to be an RPC/protobuf error!");
          addLog(
            "error",
            `Unhandled RPC Error: ${event.reason?.message || event.reason}`
          );
          setRpcError(
            `Unhandled Error: ${event.reason?.message || JSON.stringify(event.reason)}\n\nThis error occurred in LiveKit's internal code and wasn't caught by our error handler.`
          );
        }
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect().catch(() => {
          // Ignore errors during cleanup
        });
      }
    };
  }, []);

  const formatTimestamp = (date: Date) => {
    return (
      date.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }) +
      "." +
      date.getMilliseconds().toString().padStart(3, "0")
    );
  };

  const getLogColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "success":
        return "text-green-400";
      case "error":
        return "text-red-400";
      case "warning":
        return "text-yellow-400";
      case "rpc-request":
        return "text-blue-400";
      case "rpc-response":
        return "text-purple-400";
      default:
        return "text-white";
    }
  };

  return (
    <div className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-6 text-3xl font-bold text-white">
          LiveKit RPC Tester
        </h1>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Connection Panel */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
            <h2 className="mb-4 text-xl font-semibold text-white">
              Connection Panel
            </h2>

            <div className="space-y-4">
              <p className="text-sm text-neutral-400">
                Credentials are loaded from server environment variables (.env.local).
                Click Connect to find and join an active room with both agent and client.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={connect}
                  disabled={isConnected || isConnecting}
                  className="flex-1 cursor-pointer rounded bg-white px-4 py-2 font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
                >
                  {isConnecting ? "Connecting..." : "Connect"}
                </button>
                <button
                  onClick={disconnect}
                  disabled={!isConnected || isConnecting}
                  className="flex-1 cursor-pointer rounded border border-neutral-700 bg-neutral-800 px-4 py-2 font-medium transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
                >
                  Disconnect
                </button>
              </div>

              {isConnected && currentRoomName && (
                <div className="mt-4 rounded border border-neutral-800 bg-neutral-900 p-3">
                  <p className="text-sm text-white">
                    ✓ Connected to room:{" "}
                    <span className="font-mono">{currentRoomName}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Participants List */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
            <h2 className="mb-4 text-xl font-semibold text-white">
              Participants
            </h2>

            <div className="space-y-2">
              {localIdentity && (
                <div className="rounded border border-neutral-700 bg-neutral-800 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">
                      {localIdentity}
                    </span>
                    <span className="text-xs text-neutral-400">Local</span>
                  </div>
                </div>
              )}

              {Array.from(participants.values())
                .filter((p) => p.identity !== localIdentity)
                .map((participant) => (
                  <div
                    key={participant.identity}
                    onClick={() => setRpcDestination(participant.identity)}
                    className={`cursor-pointer rounded border p-3 transition-colors ${
                      rpcDestination === participant.identity
                        ? "border-neutral-700 bg-neutral-800"
                        : "border-neutral-800 bg-black hover:bg-neutral-900"
                    }`}
                    title="Click to select as RPC destination"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white">{participant.identity}</span>
                      {rpcDestination === participant.identity && (
                        <span className="text-xs text-neutral-400">
                          ✓ Selected
                        </span>
                      )}
                    </div>
                  </div>
                ))}

              {participants.size === 0 && (
                <p className="text-sm italic text-neutral-500">
                  No participants
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* RPC Request Panel */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
            <h2 className="mb-4 text-xl font-semibold text-white">
              RPC Request
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-300">
                  Destination Identity
                </label>
                <input
                  type="text"
                  value={rpcDestination}
                  onChange={(e) => setRpcDestination(e.target.value)}
                  placeholder="participant-identity"
                  disabled={!isConnected}
                  className="w-full rounded border border-neutral-800 bg-black px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-20 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-300">
                  Method Name
                </label>
                <input
                  type="text"
                  value={rpcMethod}
                  onChange={(e) => setRpcMethod(e.target.value)}
                  placeholder="methodName"
                  disabled={!isConnected}
                  className="w-full rounded border border-neutral-800 bg-black px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-20 disabled:opacity-50"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium text-neutral-300">
                    Payload (JSON or string)
                  </label>
                  {rpcPayload && (
                    <span
                      className={`text-xs ${
                        new Blob([rpcPayload]).size > 60000
                          ? "text-red-400"
                          : new Blob([rpcPayload]).size > 50000
                            ? "text-yellow-400"
                            : "text-neutral-400"
                      }`}
                    >
                      {Math.round(new Blob([rpcPayload]).size / 1024)} KB
                    </span>
                  )}
                </div>
                <textarea
                  value={rpcPayload}
                  onChange={(e) => setRpcPayload(e.target.value)}
                  placeholder='{"key": "value"} or plain text'
                  disabled={!isConnected}
                  rows={12}
                  style={{ resize: "none" }}
                  className="w-full rounded border border-neutral-800 bg-black px-4 py-2 font-mono text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-20 disabled:opacity-50"
                />
                {rpcPayload && new Blob([rpcPayload]).size > 60000 && (
                  <p className="mt-1 text-xs text-red-400">
                    Warning: Payload exceeds 60KB - may cause errors. Consider
                    chunking or reducing size.
                  </p>
                )}
              </div>

              <button
                onClick={sendRpc}
                disabled={!isConnected}
                className="w-full cursor-pointer rounded bg-white px-4 py-2 font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
              >
                Send RPC
              </button>
            </div>
          </div>

          {/* RPC Response Panel */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
            <h2 className="mb-4 text-xl font-semibold text-white">
              RPC Response
            </h2>

            <div className="space-y-4">
              {rpcError ? (
                <div className="rounded border border-neutral-800 bg-neutral-900 p-4">
                  <p className="mb-2 font-medium text-red-400">Error:</p>
                  <pre className="whitespace-pre-wrap wrap-break-word font-mono text-sm text-red-300">
                    {rpcError}
                  </pre>
                </div>
              ) : rpcResponse ? (
                <div className="rounded border border-neutral-800 bg-black p-4">
                  <pre className="whitespace-pre-wrap wrap-break-word font-mono text-sm text-white">
                    {rpcResponse}
                  </pre>
                </div>
              ) : (
                <div className="rounded border border-neutral-800 bg-black p-4">
                  <p className="text-sm italic text-neutral-500">
                    No response yet
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Event Log */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Event Log</h2>
            <button
              onClick={() => setLogs([])}
              className="cursor-pointer rounded border border-neutral-700 bg-neutral-800 px-3 py-1 text-sm transition-colors hover:bg-neutral-700"
            >
              Clear
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto rounded border border-neutral-800 bg-black p-4">
            {logs.length === 0 ? (
              <p className="text-sm italic text-neutral-500">No events yet</p>
            ) : (
              <div className="space-y-2 font-mono text-sm">
                {logs.map((log, index) => (
                  <div key={index} className="flex gap-3">
                    <span className="whitespace-nowrap text-xs text-neutral-500">
                      {formatTimestamp(log.timestamp)}
                    </span>
                    <span className={`${getLogColor(log.type)} flex-1`}>
                      [{log.type.toUpperCase()}] {log.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
