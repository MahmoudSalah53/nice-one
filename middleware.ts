import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "__ep_staging_auth";
const DEFAULT_ACCESS_PASSWORD = "ElectroPi@2026";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

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
    enc.encode(`ep-access-gate-v1:${password}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode("authorized-staging-session"),
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

function buildGateHtml(): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
  <title>Protected Environment</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      min-height: 100vh;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: radial-gradient(circle at 50% 0%, #18181b 0%, #09090b 70%);
      color: #f4f4f5;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      width: min(92vw, 400px);
      background: rgba(24, 24, 27, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 18px;
      padding: 28px 24px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(12px);
    }
    .badge {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: rgba(239, 68, 68, 0.14);
      border: 1px solid rgba(239, 68, 68, 0.32);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
      color: #f87171;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 1.2rem;
      font-weight: 700;
      color: #ffffff;
    }
    p {
      margin: 0 0 20px;
      font-size: 0.88rem;
      line-height: 1.5;
      color: #a1a1aa;
    }
    .field {
      position: relative;
      margin-bottom: 14px;
    }
    input {
      width: 100%;
      padding: 12px 42px 12px 14px;
      border-radius: 11px;
      border: 1px solid #27272a;
      background: #09090b;
      color: #fafafa;
      font-size: 0.95rem;
      direction: ltr;
      text-align: left;
      outline: none;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }
    input:focus {
      border-color: #ef4444;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.18);
    }
    .toggle-btn {
      position: absolute;
      top: 50%;
      right: 10px;
      transform: translateY(-50%);
      background: transparent;
      border: none;
      color: #71717a;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .toggle-btn:hover { color: #d4d4d8; }
    .submit-btn {
      width: 100%;
      padding: 12px 16px;
      border-radius: 11px;
      border: none;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: #ffffff;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.18s ease, transform 0.1s ease;
    }
    .submit-btn:hover { opacity: 0.94; }
    .submit-btn:active { transform: scale(0.99); }
    .submit-btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .err {
      margin-top: 12px;
      font-size: 0.84rem;
      color: #f87171;
      min-height: 20px;
      text-align: center;
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="badge" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
    </div>
    <h1>بيئة اختبار محمية</h1>
    <p>يرجى إدخال رمز الوصول الخاص بالفريق للمتابعة.</p>
    <form id="gate-form" autocomplete="off">
      <div class="field">
        <input
          id="access-code"
          name="code"
          type="password"
          placeholder="Access Code"
          autocomplete="off"
          autofocus
          required
        />
        <button type="button" class="toggle-btn" id="toggle-vis" aria-label="Show code">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
      </div>
      <button type="submit" class="submit-btn" id="submit-btn">دخول</button>
      <div class="err" id="err-msg" role="alert"></div>
    </form>
  </main>
  <script>
    (function () {
      var form = document.getElementById("gate-form");
      var input = document.getElementById("access-code");
      var btn = document.getElementById("submit-btn");
      var err = document.getElementById("err-msg");
      var toggle = document.getElementById("toggle-vis");

      toggle.addEventListener("click", function () {
        input.type = input.type === "password" ? "text" : "password";
        input.focus();
      });

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var code = input.value.trim();
        if (!code) return;
        btn.disabled = true;
        btn.textContent = "جاري التحقق...";
        err.textContent = "";

        fetch("/__auth/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ password: code }),
        })
          .then(function (res) {
            return res.json().then(function (data) {
              return { ok: res.ok, data: data };
            });
          })
          .then(function (result) {
            if (result.ok && result.data && result.data.ok) {
              window.location.reload();
              return;
            }
            err.textContent = (result.data && result.data.error) || "رمز الوصول غير صحيح";
            btn.disabled = false;
            btn.textContent = "دخول";
            input.select();
          })
          .catch(function () {
            err.textContent = "تعذر الاتصال بالسيرفر، حاول مرة أخرى";
            btn.disabled = false;
            btn.textContent = "دخول";
          });
      });
    })();
  </script>
</body>
</html>`;
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

  const configuredPassword = getConfiguredPassword();
  const expectedToken = await computeAuthToken(configuredPassword);

  // 2. Handle password unlock submission directly in middleware
  if (pathname === "/__auth/unlock" && request.method === "POST") {
    let submitted = "";
    try {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = (await request.json()) as {
          password?: string;
          code?: string;
        };
        submitted = String(body?.password ?? body?.code ?? "").trim();
      } else {
        const formData = await request.formData();
        submitted = String(
          formData.get("password") ?? formData.get("code") ?? "",
        ).trim();
      }
    } catch {
      return NextResponse.json(
        { ok: false, error: "طلب غير صالح" },
        { status: 400, headers: SECURITY_HEADERS },
      );
    }

    if (!submitted || !timingSafeEqualStr(submitted, configuredPassword)) {
      return NextResponse.json(
        { ok: false, error: "رمز الوصول غير صحيح" },
        { status: 401, headers: SECURITY_HEADERS },
      );
    }

    const res = NextResponse.json(
      { ok: true },
      { status: 200, headers: SECURITY_HEADERS },
    );
    res.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: expectedToken,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
      secure: isHttpsRequest(request),
    });
    return res;
  }

  // 3. Handle logout endpoint
  if (pathname === "/__auth/logout") {
    const redirectUrl = new URL("/", request.url);
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.delete(AUTH_COOKIE_NAME);
    return res;
  }

  // 4. Allow LiveKit token generation endpoint (JSON-only, zero proxied content)
  if (
    pathname === "/api/connection-details" &&
    (request.method === "POST" || request.method === "OPTIONS")
  ) {
    return NextResponse.next();
  }

  // 5. Verify signed session cookie
  const currentCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value || "";
  if (currentCookie && timingSafeEqualStr(currentCookie, expectedToken)) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
    return res;
  }

  // 6. Block unauthenticated requests before any route or reverse-proxy rewrite runs
  const accept = request.headers.get("accept") || "";
  const isBrowserPageNavigation =
    request.method === "GET" &&
    accept.includes("text/html") &&
    !isAssetOrApiPath(pathname);

  if (isBrowserPageNavigation) {
    return new NextResponse(buildGateHtml(), {
      status: 401,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        ...SECURITY_HEADERS,
      },
    });
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
