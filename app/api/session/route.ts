import { NextResponse } from "next/server";
import { getNiceOneSession } from "@/lib/niceone-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const incomingCookie = request.headers.get("cookie");
  const sessionData = await getNiceOneSession(true, incomingCookie);

  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
  });

  if (sessionData.session) {
    headers.append(
      "Set-Cookie",
      `_session=${encodeURIComponent(sessionData.session)}; Path=/; Max-Age=604800; SameSite=Lax`,
    );
  }
  if (sessionData.verifyToken) {
    headers.append(
      "Set-Cookie",
      `_verify_token=${encodeURIComponent(sessionData.verifyToken)}; Path=/; Max-Age=300; SameSite=Lax`,
    );
  }

  return new NextResponse(JSON.stringify({ status: true }), {
    status: 200,
    headers,
  });
}
