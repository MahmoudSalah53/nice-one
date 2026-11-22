import { NextRequest, NextResponse } from "next/server";
import { buildGateHtml } from "@/lib/access-gate-html";

const LEGACY_AUTH_COOKIE_NAME = "__ep_staging_auth";
const AUTH_COOKIE_NAME = "__ep_staging_auth_v2";
const DEFAULT_ACCESS_PASSWORD = "ElectroPi@2026";

const PUBLIC_BRAND_ASSETS = new Set([
  "/eracoda-logo-light.png",
  "/eracoda-logo-dark.png",
  "/eracoda-icon.svg",
]);

const SECURITY_HEADERS: Record<string, string> = {
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
};

function getConfiguredPassword(): string {
  return (
    process.env.ACCESS_PASSWORD?.trim() ||
    process.env.MIDDLEWARE_PASSWORD?.trim() ||
    DEFAULT_ACCESS_PASSWORD
  );
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLen; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

async function computeAuthToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(`ep-access-gate-v2:${password}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode("authorized-staging-session-v2"),
  );
  return toHex(sig);
}

function isHttpsRequest(request: NextRequest): boolean {
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  if (forwardedProto) {
    return forwardedProto === "https";
  }
  return request.nextUrl.protocol === "https:";
}

function isAssetOrApiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_ipx/") ||
    pathname.startsWith("/_nuxt/") ||
    pathname.startsWith("/web/") ||
    pathname.startsWith("/image/") ||
    pathname.startsWith("/images/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/favicon.ico"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Disallow all search/scanner bots immediately via robots.txt
  if (pathname === "/robots.txt") {
    return new NextResponse("User-agent: *\nDisallow: /\n", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        ...SECURITY_HEADERS,
      },
    });
  }

  // 2. Allow EraCoda gate brand logo & icon to render on the 401 gate page
  if (
    PUBLIC_BRAND_ASSETS.has(pathname) &&
    (request.method === "GET" || request.method === "HEAD")
  ) {
    return NextResponse.next();
  }

  const configuredPassword = getConfiguredPassword();
  const expectedToken = await computeAuthToken(configuredPassword);

  // 3. Handle password + consent unlock submission directly in middleware
  if (pathname === "/__auth/unlock" && request.method === "POST") {
    let submitted = "";
    let accepted = false;
    try {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = (await request.json()) as {
          password?: string;
          code?: string;
          accepted?: boolean;
        };
        submitted = String(body?.password ?? body?.code ?? "").trim();
        accepted = body?.accepted === true;
      } else {
        const formData = await request.formData();
        submitted = String(
          formData.get("password") ?? formData.get("code") ?? "",
        ).trim();
        const rawAccepted = String(formData.get("accepted") ?? "").toLowerCase();
        accepted = rawAccepted === "true" || rawAccepted === "on" || rawAccepted === "1";
      }
    } catch {
      return NextResponse.json(
        { ok: false, error: "طلب غير صالح" },
        { status: 400, headers: SECURITY_HEADERS },
      );
    }

    if (!accepted) {
      return NextResponse.json(
        { ok: false, error: "يرجى تفعيل مربع الموافقة على الإقرار أولاً للمتابعة" },
        { status: 400, headers: SECURITY_HEADERS },
      );
    }

    if (!submitted || !timingSafeEqualStr(submitted, configuredPassword)) {
      return NextResponse.json(
        { ok: false, error: "كلمة المرور غير صحيحة" },
        { status: 401, headers: SECURITY_HEADERS },
      );
    }

    const res = NextResponse.json(
      { ok: true },
      { status: 200, headers: SECURITY_HEADERS },
    );
    // Clear legacy 7-day cookie if present
    res.cookies.delete(LEGACY_AUTH_COOKIE_NAME);
    // Session cookie (no maxAge/expires) -> cleared automatically when the browser closes
    res.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: expectedToken,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isHttpsRequest(request),
    });
    return res;
  }

  // 4. Handle logout endpoint
  if (pathname === "/__auth/logout") {
    const redirectUrl = new URL("/", request.url);
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.delete(LEGACY_AUTH_COOKIE_NAME);
    res.cookies.delete(AUTH_COOKIE_NAME);
    return res;
  }

  // 5. Allow LiveKit token generation endpoint (JSON-only, zero proxied content)
  if (
    pathname === "/api/connection-details" &&
    (request.method === "POST" || request.method === "OPTIONS")
  ) {
    return NextResponse.next();
  }

  // 6. Verify signed session cookie
  const currentCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value || "";
  if (currentCookie && timingSafeEqualStr(currentCookie, expectedToken)) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
    return res;
  }

  // 7. Block unauthenticated requests before any route or reverse-proxy rewrite runs
  const accept = request.headers.get("accept") || "";
  const isBrowserPageNavigation =
    request.method === "GET" &&
    accept.includes("text/html") &&
    !isAssetOrApiPath(pathname);

  if (isBrowserPageNavigation) {
    const res = new NextResponse(buildGateHtml(), {
      status: 401,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        ...SECURITY_HEADERS,
      },
    });
    if (request.cookies.has(LEGACY_AUTH_COOKIE_NAME)) {
      res.cookies.delete(LEGACY_AUTH_COOKIE_NAME);
    }
    return res;
  }

  return NextResponse.json(
    { error: "Unauthorized" },
    {
      status: 401,
      headers: SECURITY_HEADERS,
    },
  );
}

export const config = {
  matcher: ["/", "/((?!_next/static|_next/image).*)"],
};
