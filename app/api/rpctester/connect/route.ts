import { NextResponse } from "next/server";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

// Read credentials from environment variables
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

function toHttpUrl(livekitUrl: string): string {
  return livekitUrl
    .replace(/^wss:\/\//, "https://")
    .replace(/^ws:\/\//, "http://");
}

/**
 * POST /api/rpctester/connect
 *
 * Uses credentials from .env.local
 * Picks the first room with >= 2 participants (agent + client),
 * then returns a participant token so the RPC tester joins as the 3rd participant.
 */
export async function POST() {
  try {
    if (!API_KEY || !API_SECRET || !LIVEKIT_URL) {
      return NextResponse.json(
        {
          error:
            "Missing LiveKit credentials in .env.local. Please set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL.",
        },
        { status: 500 }
      );
    }

    const host = toHttpUrl(LIVEKIT_URL);
    const roomService = new RoomServiceClient(host, API_KEY, API_SECRET);

    const rooms = await roomService.listRooms();
    const candidates = (rooms ?? []).filter(
      (r) => (r?.numParticipants ?? 0) >= 2 && r?.name
    );

    for (const r of candidates) {
      const roomName = r.name;
      const participants = await roomService.listParticipants(roomName);
      if ((participants ?? []).length >= 2) {
        const participantName = "rpc-tester";
        const participantIdentity = `rpc_tester_${Date.now()}`;

        const at = new AccessToken(API_KEY, API_SECRET, {
          identity: participantIdentity,
          name: participantName,
          ttl: "15m",
        });
        at.addGrant({
          room: roomName,
          roomJoin: true,
          canPublish: true,
          canPublishData: true,
          canSubscribe: true,
        });

        return NextResponse.json({
          serverUrl: LIVEKIT_URL,
          roomName,
          participantName,
          participantIdentity,
          participantToken: await at.toJwt(),
          existingParticipantIdentities: participants
            .map((p) => p.identity)
            .filter(Boolean),
        });
      }
    }

    return NextResponse.json(
      {
        error: "No room found with >= 2 participants (agent + client).",
        rooms: (rooms ?? []).map((r) => ({
          name: r?.name,
          numParticipants: r?.numParticipants ?? 0,
        })),
      },
      { status: 404 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
