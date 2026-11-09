import { NextResponse } from "next/server";
import {
  AccessToken,
  type AccessTokenOptions,
  type VideoGrant,
  RoomServiceClient,
} from "livekit-server-sdk";
import { RoomConfiguration } from "@livekit/protocol";

// NOTE: you are expected to define the following environment variables in `.env.local`:
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

// don't cache the results
export const revalidate = 0;

export type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

export async function OPTIONS() {
  // Handle CORS preflight
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Sandbox-Id",
    },
  });
}

export async function POST(req: Request) {
  try {
    if (LIVEKIT_URL === undefined) {
      throw new Error("LIVEKIT_URL is not defined");
    }
    if (API_KEY === undefined) {
      throw new Error("LIVEKIT_API_KEY is not defined");
    }
    if (API_SECRET === undefined) {
      throw new Error("LIVEKIT_API_SECRET is not defined");
    }

    // Parse agent configuration from request body
    const body = await req.json();
    const agentName: string = body?.room_config?.agents?.[0]?.agent_name;
    const existingRoomName: string | undefined = body?.room_name;
    const serializerVersion: string | undefined = body?.serializer_version;

    // Generate participant token
    const participantName = "user";
    // Reuse existing room name if provided, otherwise generate new one
    const roomName = existingRoomName || `room-${new Date().getTime()}`;
    // Reuse existing participant identity if room is reused, otherwise generate new one
    const participantIdentity = existingRoomName
      ? `voice_assistant_user_${existingRoomName.replace("room-", "")}`
      : `voice_assistant_user_${new Date().getTime()}`;

    // Try to get room ID if room already exists
    try {
      const roomService = new RoomServiceClient(
        LIVEKIT_URL,
        API_KEY,
        API_SECRET,
      );
      const rooms = await roomService.listRooms([roomName]);
      if (rooms.length > 0) {
        console.log("participantIdentity => ", participantIdentity);
        console.log("roomName => ", roomName);
        console.log("roomId (sid) => ", rooms[0].sid);
      } else {
        console.log("navigate to watch room details");
      }
    } catch {
      console.log("roomId (sid) =>  (could not fetch room info)");
    }

    const participantToken = await createParticipantToken(
      {
        identity: participantIdentity,
        name: participantName,
        attributes: {
          ...(serializerVersion && { serializer_version: serializerVersion }),
        },
        metadata: serializerVersion ?? "node",
      },
      roomName,
      agentName,
    );

    // Return connection details
    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantToken: participantToken,
      participantName,
    };
    const headers = new Headers({
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Sandbox-Id",
    });
    return NextResponse.json(data, { headers });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  agentName?: string,
): Promise<string> {
  const at = new AccessToken(API_KEY, API_SECRET, {
    ...userInfo,
    ttl: "15m",
  });
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);

  if (agentName) {
    at.roomConfig = new RoomConfiguration({
      agents: [{ agentName }],
    });
  }

  return at.toJwt();
}
