import { NextResponse } from "next/server";
import { getNiceOneSession } from "@/lib/niceone-proxy";

export const dynamic = "force-dynamic";

const ALLOWED_HOSTS = new Set([
  "api.niceonesa.com",
  "notification-center.niceonesa.com",
  "niceonesa.com",
  "www.niceonesa.com",
]);

async function handleProxy(request: Request): Promise<Response> {
  const reqUrl = new URL(request.url);
  const rawTarget = reqUrl.searchParams.get("url");

  if (!rawTarget) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawTarget);
  } catch {
    return NextResponse.json({ error: "Invalid url parameter" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(targetUrl.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  const incomingCookie = request.headers.get("cookie");
  let sessionData = await getNiceOneSession(false, incomingCookie);

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const bodyBuffer = hasBody ? await request.arrayBuffer() : undefined;

  async function executeUpstream(sessionToken: string, verifyToken: string) {
    const headers: Record<string, string> = {
      Origin: "https://niceonesa.com",
      Referer: "https://niceonesa.com/",
      "User-Agent":
        request.headers.get("user-agent") ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: request.headers.get("accept") || "application/json, text/plain, */*",
      platform: request.headers.get("platform") || "web",
      versionnumber: request.headers.get("versionnumber") || "5.6.0",
      "x-oc-currency": request.headers.get("x-oc-currency") || "SAR",
      "x-oc-merchant-id":
        request.headers.get("x-oc-merchant-id") ||
        "2afc3973-04a5-4913-83f8-d45b0156b5f1",
      "x-oc-restadmin-id":
        request.headers.get("x-oc-restadmin-id") ||
        "c15378d0-04f1-4d36-9af7-ab7e17da918b",
      "x-oc-merchant-language":
        request.headers.get("x-oc-merchant-language") || "en",
      "web-layout": request.headers.get("web-layout") || "laptop",
    };

    const clientSession = request.headers.get("x-oc-session") || sessionToken;
    if (clientSession) {
      headers["x-oc-session"] = clientSession;
    }

    const clientVerify = request.headers.get("verify-token") || verifyToken;
    if (clientVerify) {
      headers["Verify-Token"] = clientVerify;
    }

    const forwardHeaders = [
      "content-type",
      "authorization",
      "zone-id",
      "store-id",
      "x-customer-group-id",
    ];
    for (const h of forwardHeaders) {
      const val = request.headers.get(h);
      if (val) headers[h] = val;
    }

    return fetch(targetUrl.toString(), {
      method,
      headers,
      body: bodyBuffer && bodyBuffer.byteLength > 0 ? bodyBuffer : undefined,
      cache: "no-store",
    });
  }

  try {
    let upstreamRes = await executeUpstream(
      sessionData.session,
      sessionData.verifyToken,
    );

    // If 403 (e.g. expired Verify-Token), refresh session once and retry with fresh token
    if (upstreamRes.status === 403) {
      sessionData = await getNiceOneSession(true, incomingCookie);
      const retryHeaders: Record<string, string> = {
        Origin: "https://niceonesa.com",
        Referer: "https://niceonesa.com/",
        "User-Agent":
          request.headers.get("user-agent") ||
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: request.headers.get("accept") || "application/json, text/plain, */*",
        platform: request.headers.get("platform") || "web",
        versionnumber: request.headers.get("versionnumber") || "5.6.0",
        "x-oc-currency": request.headers.get("x-oc-currency") || "SAR",
        "x-oc-merchant-id":
          request.headers.get("x-oc-merchant-id") ||
          "2afc3973-04a5-4913-83f8-d45b0156b5f1",
        "x-oc-restadmin-id":
          request.headers.get("x-oc-restadmin-id") ||
          "c15378d0-04f1-4d36-9af7-ab7e17da918b",
        "x-oc-merchant-language":
          request.headers.get("x-oc-merchant-language") || "en",
        "web-layout": request.headers.get("web-layout") || "laptop",
        "x-oc-session": sessionData.session,
        "Verify-Token": sessionData.verifyToken,
      };
      for (const h of [
        "content-type",
        "authorization",
        "zone-id",
        "store-id",
        "x-customer-group-id",
      ]) {
        const val = request.headers.get(h);
        if (val) retryHeaders[h] = val;
      }

      upstreamRes = await fetch(targetUrl.toString(), {
        method,
        headers: retryHeaders,
        body: bodyBuffer && bodyBuffer.byteLength > 0 ? bodyBuffer : undefined,
        cache: "no-store",
      });
    }

    const resBody = await upstreamRes.arrayBuffer();
    const resHeaders = new Headers({
      "Content-Type":
        upstreamRes.headers.get("content-type") || "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    });

    return new NextResponse(resBody, {
      status: upstreamRes.status,
      headers: resHeaders,
    });
  } catch (error) {
    console.error("[Nice One Upstream Proxy] Error:", targetUrl.toString(), error);
    return NextResponse.json({ error: "Upstream request failed" }, { status: 502 });
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
export const PATCH = handleProxy;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
