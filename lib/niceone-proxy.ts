import { NextResponse } from "next/server";

const NICEONE_UPSTREAM = "https://niceonesa.com";

export interface NiceOneSessionData {
  session: string;
  verifyToken: string;
  expiresAt: number;
}

let cachedSession: NiceOneSessionData | null = null;

export async function getNiceOneSession(
  forceRefresh = false,
  incomingCookieHeader?: string | null,
): Promise<NiceOneSessionData> {
  if (!forceRefresh && incomingCookieHeader) {
    const sMatch = incomingCookieHeader.match(/(?:^|;\s*)_session=([^;]+)/);
    const vMatch = incomingCookieHeader.match(/(?:^|;\s*)_verify_token=([^;]+)/);
    if (sMatch?.[1] && vMatch?.[1]) {
      try {
        const tokenStr = decodeURIComponent(vMatch[1]);
        const payload = JSON.parse(
          Buffer.from(tokenStr.split(".")[1], "base64url").toString("utf8"),
        );
        if (payload.exp && payload.exp * 1000 - Date.now() > 60_000) {
          return {
            session: decodeURIComponent(sMatch[1]),
            verifyToken: tokenStr,
            expiresAt: payload.exp * 1000,
          };
        }
      } catch {}
    }
  }

  if (!forceRefresh && cachedSession && cachedSession.expiresAt - Date.now() > 60_000) {
    return cachedSession;
  }

  try {
    const res = await fetch(`${NICEONE_UPSTREAM}/api/session`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        ...(incomingCookieHeader ? { Cookie: incomingCookieHeader } : {}),
      },
      cache: "no-store",
    });

    const setCookies = res.headers.getSetCookie
      ? res.headers.getSetCookie()
      : [res.headers.get("set-cookie") || ""].filter(Boolean);

    let session = cachedSession?.session || "";
    let verifyToken = "";
    let expiresAt = Date.now() + 240_000;

    for (const c of setCookies) {
      const m1 = c.match(/_session=([^;]+)/);
      if (m1?.[1]) session = decodeURIComponent(m1[1]);
      const m2 = c.match(/_verify_token=([^;]+)/);
      if (m2?.[1]) verifyToken = decodeURIComponent(m2[1]);
    }

    if (!session && incomingCookieHeader) {
      const sMatch = incomingCookieHeader.match(/(?:^|;\s*)_session=([^;]+)/);
      if (sMatch?.[1]) session = decodeURIComponent(sMatch[1]);
    }

    if (verifyToken) {
      try {
        const payload = JSON.parse(
          Buffer.from(verifyToken.split(".")[1], "base64url").toString("utf8"),
        );
        if (payload.exp) expiresAt = payload.exp * 1000;
      } catch {}
    }

    if (session && verifyToken) {
      cachedSession = { session, verifyToken, expiresAt };
      return cachedSession;
    }
  } catch (err) {
    console.error("[Nice One Proxy] Failed to fetch /api/session:", err);
  }

  return cachedSession || { session: "", verifyToken: "", expiresAt: 0 };
}

function buildHostShellHtml(locale: "ar" | "en", localPath: string, search: string): string {
  const params = new URLSearchParams(search || "");
  params.set("__frame", "1");
  const initialFrameSrc = `${localPath}?${params.toString()}`;
  const defaultTitle =
    locale === "ar"
      ? "نايس ون | Nice One السعودية"
      : "Nice One | Online Beauty & Skincare Products";

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
  <title>${defaultTitle}</title>
  <link rel="icon" href="https://cdn.niceonesa.com/web/assets_v2/images/favicon.ico" sizes="32x32" />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #ffffff;
    }
    #niceone-live-frame {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      border: none;
      margin: 0;
      padding: 0;
      z-index: 1;
      background: #ffffff;
    }
    #lk-iframe-embed-wrapper {
      min-height: 120px !important;
    }
  </style>
</head>
<body>
  <iframe
    id="niceone-live-frame"
    src="${initialFrameSrc}"
    allow="fullscreen *; geolocation *; autoplay *; clipboard-write *"
  ></iframe>

  <script>
    (function () {
      var frame = document.getElementById("niceone-live-frame");

      function toFrameUrl(pathname, search, hash) {
        var params = new URLSearchParams(search || "");
        params.set("__frame", "1");
        var qs = params.toString();
        return pathname + (qs ? "?" + qs : "") + (hash || "");
      }

      // Clean any leftover __frame param from the top-level browser URL bar
      try {
        var topUrl = new URL(window.location.href);
        if (topUrl.searchParams.has("__frame")) {
          topUrl.searchParams.delete("__frame");
          var cleanTop = topUrl.pathname + (topUrl.searchParams.toString() ? "?" + topUrl.searchParams.toString() : "") + topUrl.hash;
          window.history.replaceState(null, "", cleanTop);
        }
      } catch (e) {}

      if (window.location.hash && frame) {
        frame.src = toFrameUrl(window.location.pathname, window.location.search, window.location.hash);
      }

      window.__niceoneCurrentUrl = "https://niceonesa.com" + window.location.pathname + window.location.search + window.location.hash;

      window.__niceoneLiveNavigate = function (rawUrl) {
        try {
          var parsed = new URL(rawUrl, window.location.origin);

          var isNiceOneHost =
            parsed.hostname === "niceonesa.com" ||
            parsed.hostname === "www.niceonesa.com" ||
            parsed.origin === window.location.origin;

          if (!isNiceOneHost) {
            return false;
          }

          var targetPath = parsed.pathname || "/${locale}";
          if (targetPath === "/") targetPath = "/${locale}";
          var targetSearchParams = new URLSearchParams(parsed.search || "");
          targetSearchParams.delete("__frame");
          var targetSearch = targetSearchParams.toString() ? "?" + targetSearchParams.toString() : "";
          var targetHash = parsed.hash || "";
          var cleanUrl = targetPath + targetSearch + targetHash;

          window.history.pushState(null, "", cleanUrl);
          window.__niceoneCurrentUrl = "https://niceonesa.com" + cleanUrl;

          if (frame) {
            try {
              var currentFrameLoc = frame.contentWindow && frame.contentWindow.location;
              if (
                currentFrameLoc &&
                currentFrameLoc.origin === window.location.origin &&
                currentFrameLoc.pathname === targetPath &&
                targetHash
              ) {
                currentFrameLoc.hash = targetHash;
                return true;
              }
            } catch (e) {}

            frame.src = toFrameUrl(targetPath, targetSearch, targetHash);
          }
          return true;
        } catch (err) {
          console.error("[Nice One Live Proxy] Navigation error:", err);
          return false;
        }
      };

      window.__alawalyLiveNavigate = window.__niceoneLiveNavigate;

      window.addEventListener("message", function (event) {
        if (!event.data || !event.data.type) return;

        if (event.data.type === "niceone-frame-load") {
          var path = event.data.path || "/${locale}";
          var searchParams = new URLSearchParams(event.data.search || "");
          searchParams.delete("__frame");
          var search = searchParams.toString() ? "?" + searchParams.toString() : "";
          var hash = event.data.hash || "";
          var title = event.data.title;
          var cleanUrl = path + search + hash;

          if (window.location.pathname + window.location.search + window.location.hash !== cleanUrl) {
            window.history.replaceState(null, "", cleanUrl);
          }
          if (title) {
            document.title = title;
          }
          window.__niceoneCurrentUrl = "https://niceonesa.com" + cleanUrl;
        }

        if (event.data.type === "niceone-frame-navigate" && event.data.url) {
          window.__niceoneLiveNavigate(event.data.url);
        }
      });

      window.addEventListener("popstate", function () {
        if (!frame) return;
        var nextUrl = toFrameUrl(window.location.pathname, window.location.search, window.location.hash);
        frame.src = nextUrl;
      });
    })();
  </script>

  <script>
    (function () {
      var s = document.createElement("script");
      s.src = "/page-automation.js";
      s.setAttribute("data-lk-sandbox-id", window.location.origin);
      document.body.appendChild(s);
    })();
  </script>
</body>
</html>`;
}

function transformNiceOneHtml(
  html: string,
  locale: "ar" | "en",
  sessionData: NiceOneSessionData,
): string {
  let output = html;

  // Rewrite only anchor hrefs pointing to niceonesa.com so we don't corrupt window.__NUXT__.config
  output = output.replace(
    /href=(["'])https?:\/\/(?:www\.)?niceonesa\.com(\/[^"']*)?\1/gi,
    (_match, quote, path) => `href=${quote}${path || `/${locale}`}${quote}`,
  );

  const bridgeScript = `
<script>
  (function () {
    // 1. Pre-seed _session and _verify_token cookies before Nuxt boots
    var SESSION_VAL = ${JSON.stringify(sessionData.session || "")};
    var VERIFY_TOKEN_VAL = ${JSON.stringify(sessionData.verifyToken || "")};
    if (SESSION_VAL && document.cookie.indexOf("_session=") === -1) {
      document.cookie = "_session=" + encodeURIComponent(SESSION_VAL) + "; path=/; max-age=604800; SameSite=Lax";
    }
    if (VERIFY_TOKEN_VAL) {
      document.cookie = "_verify_token=" + encodeURIComponent(VERIFY_TOKEN_VAL) + "; path=/; max-age=300; SameSite=Lax";
    }

    // 2. Strip internal __frame=1 query param before Nuxt router initializes
    try {
      var initUrl = new URL(window.location.href);
      if (initUrl.searchParams.has("__frame")) {
        initUrl.searchParams.delete("__frame");
        var cleanInit = initUrl.pathname + (initUrl.searchParams.toString() ? "?" + initUrl.searchParams.toString() : "") + initUrl.hash;
        window.history.replaceState(null, "", cleanInit);
      }
    } catch (e) {}

    // 3. Intercept XMLHttpRequest and fetch to route Nice One API calls through local proxy (avoiding CORS)
    function rewriteApiUrl(rawUrl) {
      if (typeof rawUrl !== "string") return rawUrl;
      if (rawUrl.startsWith("https://niceonesa.com/api/session")) {
        return "/api/session";
      }
      if (
        rawUrl.startsWith("https://api.niceonesa.com") ||
        rawUrl.startsWith("https://notification-center.niceonesa.com") ||
        rawUrl.startsWith("https://niceonesa.com/api/")
      ) {
        return "/api/niceone-upstream?url=" + encodeURIComponent(rawUrl);
      }
      return rawUrl;
    }

    var origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      var args = Array.prototype.slice.call(arguments);
      if (typeof url === "string") {
        args[1] = rewriteApiUrl(url);
      } else if (url && typeof url.toString === "function") {
        args[1] = rewriteApiUrl(url.toString());
      }
      return origOpen.apply(this, args);
    };

    var origFetch = window.fetch;
    if (origFetch) {
      window.fetch = function (input, init) {
        if (typeof input === "string") {
          input = rewriteApiUrl(input);
        } else if (input && typeof input === "object" && typeof input.url === "string") {
          var newUrl = rewriteApiUrl(input.url);
          if (newUrl !== input.url) {
            input = new Request(newUrl, input);
          }
        }
        return origFetch.call(this, input, init);
      };
    }

    // 4. Sync navigation state with parent Host Shell
    function notifyParent() {
      if (window.parent && window.parent !== window) {
        var sp = new URLSearchParams(window.location.search || "");
        sp.delete("__frame");
        var cleanSearch = sp.toString() ? "?" + sp.toString() : "";
        window.parent.postMessage(
          {
            type: "niceone-frame-load",
            path: window.location.pathname,
            search: cleanSearch,
            hash: window.location.hash || "",
            title: document.title || "",
          },
          "*"
        );
      }
    }

    var origPushState = history.pushState;
    history.pushState = function () {
      var ret = origPushState.apply(this, arguments);
      setTimeout(notifyParent, 50);
      return ret;
    };

    var origReplaceState = history.replaceState;
    history.replaceState = function () {
      var ret = origReplaceState.apply(this, arguments);
      setTimeout(notifyParent, 50);
      return ret;
    };

    document.addEventListener("DOMContentLoaded", notifyParent);
    window.addEventListener("load", notifyParent);
    window.addEventListener("hashchange", notifyParent);
    window.addEventListener("popstate", notifyParent);

    // Fallback: if this page is ever rendered at top-level directly, ensure Voice Agent is injected
    if (window.self === window.top) {
      window.addEventListener("DOMContentLoaded", function () {
        if (!document.querySelector('script[src="/page-automation.js"]')) {
          var s = document.createElement("script");
          s.src = "/page-automation.js";
          s.setAttribute("data-lk-sandbox-id", window.location.origin);
          document.body.appendChild(s);
        }
      });
    }

    document.addEventListener(
      "click",
      function (e) {
        var target = e.target;
        if (!target || typeof target.closest !== "function") return;
        var link = target.closest("a[href]");
        if (!link) return;
        var rawHref = link.getAttribute("href") || "";
        if (
          !rawHref ||
          rawHref.startsWith("#") ||
          rawHref.startsWith("mailto:") ||
          rawHref.startsWith("tel:") ||
          rawHref.startsWith("javascript:")
        ) {
          return;
        }

        try {
          var parsed = new URL(rawHref, window.location.origin);
          if (parsed.hostname === "niceonesa.com" || parsed.hostname === "www.niceonesa.com") {
            e.preventDefault();
            e.stopPropagation();
            var localTarget = (parsed.pathname || "/${locale}") + parsed.search + parsed.hash;
            window.location.href = localTarget;
          }
        } catch (err) {}
      },
      true
    );
  })();
</script>`;

  if (/<head[^>]*>/i.test(output)) {
    output = output.replace(/<head[^>]*>/i, (match) => `${match}${bridgeScript}`);
  } else {
    output = bridgeScript + output;
  }

  return output;
}

export async function handleNiceOneProxyRequest(
  request: Request,
  locale: "ar" | "en",
  slug?: string[],
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const slugPath = slug && slug.length > 0 ? "/" + slug.join("/") : "";
  const localPath = `/${locale}${slugPath}`;

  const secFetchDest = request.headers.get("sec-fetch-dest");
  const isFrameRequest =
    secFetchDest === "iframe" ||
    (secFetchDest !== "document" && requestUrl.searchParams.get("__frame") === "1");

  const upstreamSearchParams = new URLSearchParams(requestUrl.searchParams);
  upstreamSearchParams.delete("__frame");
  const cleanSearch = upstreamSearchParams.toString()
    ? `?${upstreamSearchParams.toString()}`
    : "";

  // Top-level browser navigation -> Serve the persistent Host Shell with the Voice Agent
  if (!isFrameRequest) {
    const shellHtml = buildHostShellHtml(locale, localPath, cleanSearch);
    return new NextResponse(shellHtml, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Vary: "Sec-Fetch-Dest",
      },
    });
  }

  // Inside iframe: fetch session & live page from niceonesa.com in parallel
  const incomingCookie = request.headers.get("cookie");
  const upstreamUrl = `${NICEONE_UPSTREAM}${localPath}${cleanSearch}`;

  try {
    const [sessionData, upstreamRes] = await Promise.all([
      getNiceOneSession(false, incomingCookie),
      fetch(upstreamUrl, {
        method: request.method,
        headers: {
          "User-Agent":
            request.headers.get("user-agent") ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language":
            locale === "ar" ? "ar,en-US;q=0.9,en;q=0.8" : "en-US,en;q=0.9,ar;q=0.8",
          ...(incomingCookie ? { Cookie: incomingCookie } : {}),
        },
        cache: "no-store",
      }),
    ]);

    const rawHtml = await upstreamRes.text();
    const transformedHtml = transformNiceOneHtml(rawHtml, locale, sessionData);

    const responseHeaders = new Headers({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Vary: "Sec-Fetch-Dest",
    });

    // Forward upstream cookies (stripping Secure and SameSite=Strict so they work on localhost & iframe)
    const upstreamCookies = upstreamRes.headers.getSetCookie
      ? upstreamRes.headers.getSetCookie()
      : [upstreamRes.headers.get("set-cookie") || ""].filter(Boolean);

    for (const rawCookie of upstreamCookies) {
      const cleaned = rawCookie
        .replace(/;\s*Secure/gi, "")
        .replace(/;\s*SameSite=Strict/gi, "; SameSite=Lax")
        .replace(/;\s*Domain=[^;]+/gi, "");
      responseHeaders.append("Set-Cookie", cleaned);
    }

    if (sessionData.session) {
      responseHeaders.append(
        "Set-Cookie",
        `_session=${encodeURIComponent(sessionData.session)}; Path=/; Max-Age=604800; SameSite=Lax`,
      );
    }
    if (sessionData.verifyToken) {
      responseHeaders.append(
        "Set-Cookie",
        `_verify_token=${encodeURIComponent(sessionData.verifyToken)}; Path=/; Max-Age=300; SameSite=Lax`,
      );
    }

    return new NextResponse(transformedHtml, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[Nice One Proxy] Error fetching upstream:", upstreamUrl, error);
    return new NextResponse(
      `<!DOCTYPE html><html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}"><body style="background:#ffffff;color:#111;font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0;"><div>تعذر الاتصال بموقع نايس ون حالياً، يرجى المحاولة مرة أخرى.</div></body></html>`,
      {
        status: 502,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  }
}
