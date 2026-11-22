import { NextRequest, NextResponse } from "next/server";

const LEGACY_AUTH_COOKIE_NAME = "__ep_staging_auth";
const AUTH_COOKIE_NAME = "__ep_staging_auth_v2";
const DEFAULT_ACCESS_PASSWORD = "ElectroPi@2026";

const PUBLIC_BRAND_ASSETS = new Set([
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

function buildGateHtml(): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
  <link rel="icon" href="/eracoda-icon.svg" type="image/svg+xml" />
  <title>EraCoda — بيئة عرض وتجربة تقنية</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      min-height: 100vh;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Tahoma, Roboto, sans-serif;
      background:
        radial-gradient(ellipse 75% 55% at 50% 0%, rgba(240, 165, 40, 0.14) 0%, transparent 60%),
        radial-gradient(circle at 50% 18%, #1a2d50 0%, #0d172a 55%, #070d1a 100%);
      color: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px 14px;
    }
    .card {
      width: min(94vw, 500px);
      background: rgba(15, 25, 46, 0.92);
      border: 1px solid rgba(240, 165, 40, 0.22);
      border-radius: 22px;
      padding: 30px 26px 24px;
      box-shadow:
        0 28px 70px rgba(0, 0, 0, 0.6),
        inset 0 1px 0 rgba(255, 255, 255, 0.06);
      backdrop-filter: blur(14px);
    }
    .brand-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      margin-bottom: 20px;
    }
    .brand-logo {
      height: 36px;
      width: auto;
      max-width: 230px;
      object-fit: contain;
      display: block;
      margin-bottom: 12px;
      filter: drop-shadow(0 4px 14px rgba(240, 165, 40, 0.16));
    }
    .env-pill {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 5px 13px;
      border-radius: 999px;
      background: rgba(240, 165, 40, 0.12);
      border: 1px solid rgba(240, 165, 40, 0.34);
      color: #f6c25b;
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.01em;
    }
    .env-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #f0a528;
      box-shadow: 0 0 8px rgba(240, 165, 40, 0.8);
    }
    .notice-box {
      background: rgba(20, 34, 61, 0.78);
      border: 1px solid rgba(240, 165, 40, 0.28);
      border-right: 3.5px solid #f0a528;
      border-radius: 14px;
      padding: 15px 16px;
      margin-bottom: 20px;
    }
    .notice-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.88rem;
      font-weight: 700;
      color: #f6c25b;
      margin: 0 0 10px;
    }
    .notice-lines {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 0.84rem;
      line-height: 1.65;
      color: #cbd5e1;
    }
    .notice-lines li strong {
      color: #ffffff;
      font-weight: 600;
    }
    .official-link {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      margin-inline-start: 4px;
      padding: 2px 10px;
      border-radius: 999px;
      background: rgba(240, 165, 40, 0.16);
      border: 1px solid rgba(240, 165, 40, 0.45);
      color: #fcd37d;
      font-weight: 700;
      font-size: 0.82rem;
      text-decoration: none;
      direction: ltr;
      transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
    }
    .official-link:hover {
      background: rgba(240, 165, 40, 0.28);
      border-color: #f0a528;
      color: #ffffff;
    }
    .notice-en {
      margin-top: 11px;
      padding-top: 9px;
      border-top: 1px solid rgba(148, 163, 184, 0.16);
      font-size: 0.74rem;
      line-height: 1.5;
      color: #94a3b8;
      direction: ltr;
      text-align: left;
    }
    .notice-en a {
      color: #f6c25b;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .field-label {
      display: block;
      font-size: 0.83rem;
      font-weight: 600;
      color: #e2e8f0;
      margin-bottom: 7px;
    }
    .field {
      position: relative;
      margin-bottom: 14px;
    }
    input[type="password"],
    input[type="text"] {
      width: 100%;
      padding: 12px 44px 12px 14px;
      border-radius: 12px;
      border: 1px solid rgba(148, 163, 184, 0.24);
      background: rgba(7, 13, 26, 0.88);
      color: #f8fafc;
      font-size: 0.95rem;
      direction: ltr;
      text-align: left;
      outline: none;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }
    input[type="password"]::placeholder,
    input[type="text"]::placeholder {
      color: #64748b;
    }
    input[type="password"]:focus,
    input[type="text"]:focus {
      border-color: #f0a528;
      box-shadow: 0 0 0 3px rgba(240, 165, 40, 0.18);
    }
    .toggle-btn {
      position: absolute;
      top: 50%;
      right: 10px;
      transform: translateY(-50%);
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s ease;
    }
    .toggle-btn:hover { color: #f6c25b; }
    .consent-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 11px 13px;
      margin-bottom: 16px;
      border-radius: 12px;
      border: 1px solid rgba(148, 163, 184, 0.22);
      background: rgba(11, 19, 36, 0.65);
      cursor: pointer;
      user-select: none;
      transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
    }
    .consent-row:hover {
      border-color: rgba(240, 165, 40, 0.42);
    }
    .consent-row.checked {
      border-color: rgba(240, 165, 40, 0.62);
      background: rgba(240, 165, 40, 0.08);
    }
    .consent-row.needs-consent {
      border-color: rgba(248, 113, 113, 0.85);
      box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.16);
    }
    .consent-row input[type="checkbox"] {
      appearance: none;
      -webkit-appearance: none;
      flex: 0 0 19px;
      width: 19px;
      height: 19px;
      margin: 2px 0 0;
      border-radius: 6px;
      border: 1.5px solid #64748b;
      background: rgba(7, 13, 26, 0.9);
      display: grid;
      place-content: center;
      cursor: pointer;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .consent-row input[type="checkbox"]::after {
      content: "";
      width: 10px;
      height: 10px;
      transform: scale(0);
      transition: transform 0.14s ease;
      background-color: #0b1324;
      clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
    }
    .consent-row input[type="checkbox"]:checked {
      border-color: #f0a528;
      background: #f0a528;
    }
    .consent-row input[type="checkbox"]:checked::after {
      transform: scale(1);
    }
    .consent-text {
      font-size: 0.81rem;
      line-height: 1.55;
      color: #cbd5e1;
    }
    .consent-text strong {
      color: #ffffff;
    }
    .submit-btn {
      width: 100%;
      padding: 13px 16px;
      border-radius: 12px;
      border: none;
      background: linear-gradient(135deg, #f5b942 0%, #e09112 100%);
      color: #0b1324;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(240, 165, 40, 0.25);
      transition: opacity 0.18s ease, transform 0.12s ease, box-shadow 0.18s ease;
    }
    .submit-btn:hover:not(:disabled) {
      opacity: 0.96;
      box-shadow: 0 10px 28px rgba(240, 165, 40, 0.36);
    }
    .submit-btn:active:not(:disabled) {
      transform: scale(0.99);
    }
    .submit-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      box-shadow: none;
    }
    .err {
      margin-top: 12px;
      font-size: 0.83rem;
      color: #fca5a5;
      min-height: 20px;
      text-align: center;
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="brand-header">
      <img src="/eracoda-logo-dark.png" alt="EraCoda" class="brand-logo" />
      <span class="env-pill">
        <span class="env-dot" aria-hidden="true"></span>
        بيئة عرض وتجربة تقنية • Technical Demo
      </span>
    </div>

    <section class="notice-box" aria-label="تنويه مهم">
      <h2 class="notice-title">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        تنويه مهم قبل المتابعة
      </h2>
      <ul class="notice-lines">
        <li>هذه المنصة هي <strong>بيئة تجربة وعرض تقني</strong> مطوّرة من قِبل <strong>EraCoda</strong> في إطار التعاون واستعراض المساعد الصوتي الذكي، <strong>وليست الموقع الرسمي لمتجر نايس ون</strong>.</li>
        <li>الهدف من هذه البيئة هو المعاينة والتجربة التقنية المعتمدة فقط، ولا تُستخدم لإتمام عمليات شراء فعلية أو جمع أي بيانات شخصية أو بنكية.</li>
        <li>
          للتسوق المباشر وإتمام الطلبات عبر المتجر الرسمي، يُرجى التوجه مباشرةً إلى الموقع الأصلي:
          <a class="official-link" href="https://niceonesa.com" target="_blank" rel="noopener noreferrer">
            niceonesa.com
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        </li>
      </ul>
      <div class="notice-en">
        Demo &amp; evaluation showcase by <strong>EraCoda</strong> — not the official Nice One storefront. For real shopping, visit <a href="https://niceonesa.com" target="_blank" rel="noopener noreferrer">niceonesa.com</a>.
      </div>
    </section>

    <form id="gate-form" autocomplete="off" novalidate>
      <label class="field-label" for="access-code">كلمة مرور بيئة التجربة</label>
      <div class="field">
        <input
          id="access-code"
          name="code"
          type="password"
          placeholder="Enter access password..."
          autocomplete="off"
          autofocus
          required
        />
        <button type="button" class="toggle-btn" id="toggle-vis" aria-label="إظهار أو إخفاء كلمة المرور">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
      </div>

      <label class="consent-row" id="consent-row" for="consent-check">
        <input id="consent-check" name="accepted" type="checkbox" required />
        <span class="consent-text">
          <strong>أقرّ وأوافق</strong> على أنني أدرك أن هذه المنصة بيئة عرض وتجربة تقنية تابعة لشركة <strong>EraCoda</strong> وليست الموقع الرسمي، وأوافق على المتابعة لغرض التجربة فقط.
        </span>
      </label>

      <button type="submit" class="submit-btn" id="submit-btn" disabled>دخول إلى بيئة التجربة</button>
      <div class="err" id="err-msg" role="alert"></div>
    </form>
  </main>

  <script>
    (function () {
      var form = document.getElementById("gate-form");
      var input = document.getElementById("access-code");
      var consent = document.getElementById("consent-check");
      var consentRow = document.getElementById("consent-row");
      var btn = document.getElementById("submit-btn");
      var err = document.getElementById("err-msg");
      var toggle = document.getElementById("toggle-vis");
      var submitting = false;

      function syncButtonState() {
        var hasCode = input.value.trim().length > 0;
        var isChecked = consent.checked;
        consentRow.classList.toggle("checked", isChecked);
        if (isChecked) {
          consentRow.classList.remove("needs-consent");
        }
        btn.disabled = submitting || !hasCode || !isChecked;
      }

      input.addEventListener("input", function () {
        if (err.textContent) err.textContent = "";
        syncButtonState();
      });

      consent.addEventListener("change", function () {
        if (err.textContent) err.textContent = "";
        syncButtonState();
      });

      toggle.addEventListener("click", function () {
        input.type = input.type === "password" ? "text" : "password";
        input.focus();
      });

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var code = input.value.trim();

        if (!code) {
          err.textContent = "يرجى إدخال كلمة المرور أولاً";
          input.focus();
          return;
        }

        if (!consent.checked) {
          err.textContent = "يرجى تفعيل مربع الموافقة على الإقرار أولاً للمتابعة";
          consentRow.classList.add("needs-consent");
          consent.focus();
          return;
        }

        submitting = true;
        syncButtonState();
        btn.textContent = "جاري التحقق...";
        err.textContent = "";

        fetch("/__auth/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ password: code, accepted: true }),
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
            submitting = false;
            err.textContent = (result.data && result.data.error) || "كلمة المرور غير صحيحة";
            btn.textContent = "دخول إلى بيئة التجربة";
            syncButtonState();
            input.select();
          })
          .catch(function () {
            submitting = false;
            err.textContent = "تعذر الاتصال بالسيرفر، حاول مرة أخرى";
            btn.textContent = "دخول إلى بيئة التجربة";
            syncButtonState();
          });
      });

      syncButtonState();
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
