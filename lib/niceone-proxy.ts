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

function buildHostShellHtml(
  locale: "ar" | "en",
  localPath: string,
  search: string,
  showCheckoutNoticeOnLoad = false,
): string {
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
  <meta name="robots" content="noindex, nofollow, noarchive" />
  <title>${defaultTitle}</title>
  <link rel="icon" href="https://cdn.niceonesa.com/web/assets_v2/images/favicon.ico" sizes="32x32" />
  <style id="ep-tab-guard-style">html { visibility: hidden; }</style>
  <script>
    (function () {
      try {
        if (window.sessionStorage.getItem("__ep_tab_verified") !== "1") {
          var nextTarget = window.location.pathname + window.location.search + window.location.hash;
          window.location.replace("/__auth/reenter?next=" + encodeURIComponent(nextTarget));
          return;
        }
      } catch (e) {}
      window.__epTabAuthorized = true;
      var gs = document.getElementById("ep-tab-guard-style");
      if (gs) gs.remove();
    })();
  </script>
  <style>
    :root {
      --ep-bar-h: 38px;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #ffffff;
    }
    #eracoda-top-disclaimer {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      min-height: 38px;
      z-index: 2147483640;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 6px 14px;
      background: linear-gradient(90deg, #0b1424 0%, #101c33 50%, #0b1424 100%);
      border-bottom: 1px solid rgba(240, 165, 40, 0.35);
      color: #cbd5e1;
      font-family: system-ui, -apple-system, "Segoe UI", Tahoma, Roboto, sans-serif;
      font-size: 12.5px;
      line-height: 1.45;
      text-align: center;
      box-sizing: border-box;
      flex-wrap: wrap;
    }
    #eracoda-top-disclaimer .ep-top-logo {
      height: 13px;
      width: auto;
      display: block;
      flex: 0 0 auto;
    }
    #eracoda-top-disclaimer .ep-top-sep {
      width: 1px;
      height: 14px;
      background: rgba(255, 255, 255, 0.16);
      flex: 0 0 auto;
    }
    #eracoda-top-disclaimer strong {
      color: #ffffff;
      font-weight: 600;
    }
    #eracoda-top-disclaimer a {
      color: #f0a528;
      font-weight: 600;
      text-decoration: none;
      direction: ltr;
      unicode-bidi: isolate;
      margin-inline-start: 4px;
    }
    #eracoda-top-disclaimer a:hover {
      text-decoration: underline;
    }
    #niceone-live-frame {
      position: fixed;
      top: var(--ep-bar-h);
      left: 0;
      right: 0;
      bottom: 0;
      width: 100vw;
      height: calc(100vh - var(--ep-bar-h));
      border: none;
      margin: 0;
      padding: 0;
      z-index: 1;
      background: #ffffff;
    }
    #lk-iframe-embed-wrapper {
      bottom: 0 !important;
      right: 0 !important;
    }
    #eracoda-demo-checkout-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(7, 12, 22, 0.76);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      font-family: system-ui, -apple-system, "Segoe UI", Tahoma, Roboto, sans-serif;
    }
    #eracoda-demo-checkout-overlay.open {
      display: flex;
    }
    #eracoda-demo-checkout-card {
      position: relative;
      width: 100%;
      max-width: 440px;
      background: linear-gradient(180deg, #101c33 0%, #0b1424 100%);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      padding: 28px 24px 24px;
      color: #e2e8f0;
      text-align: center;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
    }
    #eracoda-demo-checkout-close {
      position: absolute;
      top: 12px;
      inset-inline-end: 12px;
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.06);
      color: #94a3b8;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background .15s, color .15s;
    }
    #eracoda-demo-checkout-close:hover {
      background: rgba(255, 255, 255, 0.14);
      color: #ffffff;
    }
    #eracoda-demo-checkout-logo {
      height: 28px;
      width: auto;
      display: block;
      margin: 0 auto 16px;
    }
    #eracoda-demo-checkout-title {
      margin: 0 0 10px;
      font-size: 18px;
      font-weight: 700;
      color: #ffffff;
    }
    #eracoda-demo-checkout-body {
      margin: 0 0 22px;
      font-size: 14px;
      line-height: 1.8;
      color: #cbd5e1;
    }
    #eracoda-demo-checkout-body strong {
      color: #f0a528;
      font-weight: 600;
    }
    .eracoda-demo-actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    #eracoda-demo-checkout-go {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      height: 44px;
      border-radius: 10px;
      background: #f0a528;
      color: #0b1424;
      font-size: 14.5px;
      font-weight: 700;
      text-decoration: none;
      transition: background .15s;
    }
    #eracoda-demo-checkout-go:hover {
      background: #f5b942;
    }
    #eracoda-demo-checkout-back {
      width: 100%;
      height: 42px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(255, 255, 255, 0.04);
      color: #cbd5e1;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background .15s, color .15s;
    }
    #eracoda-demo-checkout-back:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }
  </style>
</head>
<body>
  <div id="eracoda-top-disclaimer" dir="${locale === "ar" ? "rtl" : "ltr"}">
    <img class="ep-top-logo" src="/eracoda-logo-dark.png" alt="EraCoda" />
    <span class="ep-top-sep" aria-hidden="true"></span>
    <span id="eracoda-top-disclaimer-text"></span>
  </div>

  <iframe
    id="niceone-live-frame"
    src="about:blank"
    allow="fullscreen *; geolocation *; autoplay *; clipboard-write *"
  ></iframe>

  <div id="eracoda-demo-checkout-overlay" role="dialog" aria-modal="true" aria-labelledby="eracoda-demo-checkout-title">
    <div id="eracoda-demo-checkout-card">
      <button type="button" id="eracoda-demo-checkout-close" aria-label="Close">&times;</button>
      <img id="eracoda-demo-checkout-logo" src="/eracoda-logo-dark.png" alt="EraCoda" />
      <h2 id="eracoda-demo-checkout-title">هذا الموقع للعرض والتجربة فقط</h2>
      <p id="eracoda-demo-checkout-body"></p>
      <div class="eracoda-demo-actions">
        <a id="eracoda-demo-checkout-go" href="https://niceonesa.com/${locale}" target="_blank" rel="noopener noreferrer"></a>
        <button type="button" id="eracoda-demo-checkout-back"></button>
      </div>
    </div>
  </div>

  <script>
    (function () {
      if (!window.__epTabAuthorized) return;
      var INITIAL_FRAME_SRC = ${JSON.stringify(initialFrameSrc)};
      var frame = document.getElementById("niceone-live-frame");
      var topBar = document.getElementById("eracoda-top-disclaimer");
      var topBarText = document.getElementById("eracoda-top-disclaimer-text");
      var checkoutOverlay = document.getElementById("eracoda-demo-checkout-overlay");
      var checkoutCard = document.getElementById("eracoda-demo-checkout-card");
      var checkoutTitle = document.getElementById("eracoda-demo-checkout-title");
      var checkoutBody = document.getElementById("eracoda-demo-checkout-body");
      var checkoutGo = document.getElementById("eracoda-demo-checkout-go");
      var checkoutBack = document.getElementById("eracoda-demo-checkout-back");
      var checkoutClose = document.getElementById("eracoda-demo-checkout-close");

      function syncTopBarHeight() {
        if (!topBar) return;
        var h = topBar.offsetHeight || 38;
        document.documentElement.style.setProperty("--ep-bar-h", h + "px");
      }

      function updateTopDisclaimerBar(langHint) {
        if (!topBar || !topBarText) return;
        var activeLang =
          langHint === "ar" || langHint === "en"
            ? langHint
            : /^\\/en(?:\\/|$)/i.test(window.location.pathname)
              ? "en"
              : "ar";
        if (activeLang === "en") {
          document.documentElement.lang = "en";
          document.documentElement.dir = "ltr";
          topBar.setAttribute("dir", "ltr");
          topBarText.innerHTML =
            '<strong>Technical Demo</strong> by EraCoda for AI voice assistant preview — Not the official Nice One store. For real shopping visit <a href="https://niceonesa.com/en" target="_blank" rel="noopener noreferrer">niceonesa.com</a>';
        } else {
          document.documentElement.lang = "ar";
          document.documentElement.dir = "rtl";
          topBar.setAttribute("dir", "rtl");
          topBarText.innerHTML =
            'هذه <strong>بيئة عرض وتجربة تقنية</strong> من EraCoda لاستعراض المساعد الصوتي، وليست الموقع الرسمي — للتسوق الفعلي: <a href="https://niceonesa.com/ar" target="_blank" rel="noopener noreferrer">niceonesa.com</a>';
        }
        syncTopBarHeight();
      }

      updateTopDisclaimerBar(${JSON.stringify(locale)});
      window.addEventListener("resize", syncTopBarHeight);

      if (frame) {
        frame.src = INITIAL_FRAME_SRC;
      }

      function isCheckoutPath(pathStr) {
        return /(?:^|\\/)checkout(?:\\/|\\?|#|$)/i.test(String(pathStr || ""));
      }

      window.__showEraCodaCheckoutModal = function (preferredLang) {
        if (!checkoutOverlay || !checkoutCard) return;
        var activeLang =
          preferredLang === "ar" || preferredLang === "en"
            ? preferredLang
            : /^\\/en(?:\\/|$)/i.test(window.location.pathname)
              ? "en"
              : "ar";

        if (activeLang === "en") {
          checkoutCard.setAttribute("dir", "ltr");
          checkoutTitle.textContent = "Demo Environment Only";
          checkoutBody.innerHTML =
            "This site is a technical demo by <strong>EraCoda</strong> to showcase the AI voice assistant. Checkout and real orders are disabled here. To complete your purchase, please visit the official Nice One store.";
          checkoutGo.textContent = "Go to Official Nice One Store (niceonesa.com)";
          checkoutGo.setAttribute("href", "https://niceonesa.com/en");
          checkoutBack.textContent = "Continue Browsing";
        } else {
          checkoutCard.setAttribute("dir", "rtl");
          checkoutTitle.textContent = "هذا الموقع للعرض والتجربة فقط";
          checkoutBody.innerHTML =
            "هذه بيئة عرض تقنية مقدّمة من <strong>EraCoda</strong> لتجربة المساعد الصوتي الذكي، ولا يمكن إتمام عمليات الشراء أو الدفع من خلالها. لإتمام طلبك والتسوق الفعلي يُرجى التوجه إلى الموقع الرسمي لمتجر نايس ون.";
          checkoutGo.textContent = "التوجه إلى موقع نايس ون الرسمي (niceonesa.com)";
          checkoutGo.setAttribute("href", "https://niceonesa.com/ar");
          checkoutBack.textContent = "العودة للتصفح";
        }
        checkoutOverlay.classList.add("open");
      };

      function closeCheckoutModal() {
        if (checkoutOverlay) checkoutOverlay.classList.remove("open");
      }

      if (checkoutClose) checkoutClose.addEventListener("click", closeCheckoutModal);
      if (checkoutBack) checkoutBack.addEventListener("click", closeCheckoutModal);
      if (checkoutOverlay) {
        checkoutOverlay.addEventListener("click", function (ev) {
          if (ev.target === checkoutOverlay) closeCheckoutModal();
        });
      }
      window.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") closeCheckoutModal();
      });
      if (${showCheckoutNoticeOnLoad ? "true" : "false"}) {
        setTimeout(function () {
          window.__showEraCodaCheckoutModal(${JSON.stringify(locale)});
        }, 250);
      }

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
          if (isCheckoutPath(targetPath)) {
            window.__showEraCodaCheckoutModal(/^\\/en(?:\\/|$)/i.test(targetPath) ? "en" : "ar");
            return true;
          }
          var targetSearchParams = new URLSearchParams(parsed.search || "");
          targetSearchParams.delete("__frame");
          var targetSearch = targetSearchParams.toString() ? "?" + targetSearchParams.toString() : "";
          var targetHash = parsed.hash || "";
          var cleanUrl = targetPath + targetSearch + targetHash;

          window.history.pushState(null, "", cleanUrl);
          window.__niceoneCurrentUrl = "https://niceonesa.com" + cleanUrl;
          updateTopDisclaimerBar(/^\\/en(?:\\/|$)/i.test(targetPath) ? "en" : "ar");

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
              if (
                frame.contentWindow &&
                typeof frame.contentWindow.__niceoneSpaNavigate === "function"
              ) {
                var spaOk = frame.contentWindow.__niceoneSpaNavigate(cleanUrl);
                if (spaOk) {
                  return true;
                }
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

      window.__niceoneRefreshStore = function () {
        try {
          if (frame && frame.contentWindow) {
            if (typeof frame.contentWindow.__niceoneRefreshStore === "function") {
              frame.contentWindow.__niceoneRefreshStore();
            } else {
              frame.contentWindow.postMessage({ type: "niceone-refresh-store" }, "*");
            }
          }
        } catch (e) {}
      };

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
          updateTopDisclaimerBar(/^\\/en(?:\\/|$)/i.test(path) ? "en" : "ar");
        }

        if (event.data.type === "niceone-frame-navigate" && event.data.url) {
          window.__niceoneLiveNavigate(event.data.url);
        }

        if (event.data.type === "niceone-demo-checkout-blocked") {
          window.__showEraCodaCheckoutModal(event.data.lang);
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
      if (!window.__epTabAuthorized) return;
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

  // Rewrite anchor/link hrefs pointing to niceonesa.com to same-origin relative paths
  output = output.replace(
    /href=(["'])https?:\/\/(?:www\.)?niceonesa\.com(\/[^"']*)?\1/gi,
    (_match, quote, path) => `href=${quote}${path || `/${locale}`}${quote}`,
  );

  // Rewrite Nuxt i18n baseUrl so the AR/EN language switcher navigates same-origin inside the proxy frame
  output = output.replace(
    /baseUrl\s*:\s*(["'])https?:\/\/(?:www\.)?niceonesa\.com\/?\1/gi,
    "baseUrl:window.location.origin",
  );

  const bridgeScript = `
<style id="eracoda-hide-promo-bar">
  #__nuxt div.relative.z-3.text-xs.px-3.py-3.font-bold.text-center {
    display: none !important;
  }
</style>
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
    if (document.cookie.indexOf("_hide_smart_banner=") === -1) {
      document.cookie = "_hide_smart_banner=true; path=/; max-age=604800; SameSite=Lax";
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

    // 4. Sync navigation state with parent Host Shell + Demo Checkout Guard
    function isCheckoutPath(urlStr) {
      return /(?:^|\\/)checkout(?:\\/|\\?|#|$)/i.test(String(urlStr || ""));
    }

    function detectCurrentLang() {
      return /^\\/en(?:\\/|$)/i.test(window.location.pathname) ? "en" : "ar";
    }

    function normalizeBtnText(raw) {
      return String(raw || "")
        .replace(/[\\u064B-\\u065F\\u0670\\u0640]/g, "")
        .replace(/[إأآ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/\\s+/g, " ")
        .trim()
        .toLowerCase();
    }

    var CHECKOUT_EXACT_TEXTS = {
      "checkout": true,
      "continue to checkout": true,
      "proceed to checkout": true,
      "go to checkout": true,
      "complete order": true,
      "place order": true,
      "اتمام الطلب": true,
      "المتابعه للدفع": true,
      "متابعه للدفع": true,
      "انهاء التسوق": true,
      "اكمل الطلب": true,
      "اتمام الشراء": true,
      "اتمام عمليه الشراء": true,
      "الانتقال للدفع": true,
      "تابع للدفع": true,
      "تأكيد الطلب": true,
      "تاكيد الطلب": true,
    };

    var CART_ONLY_CHECKOUT_TEXTS = {
      "الدفع": true,
      "الدفع الان": true,
      "ادفع الان": true,
      "pay": true,
      "pay now": true,
      "apple pay": true,
    };

    function isCheckoutTriggerElement(el) {
      if (!el) return false;
      var href = (el.getAttribute && el.getAttribute("href")) || "";
      if (href && isCheckoutPath(href)) return true;

      var meta = (
        ((el.getAttribute && el.getAttribute("data-testid")) || "") +
        " " +
        ((el.getAttribute && el.getAttribute("aria-label")) || "") +
        " " +
        (el.id || "")
      ).toLowerCase();
      if (meta.indexOf("checkout") !== -1) return true;

      var txt = normalizeBtnText(el.innerText || el.textContent || "");
      if (!txt || txt.length > 60) return false;
      if (CHECKOUT_EXACT_TEXTS[txt]) return true;

      var onCartPage = /(?:^|\\/)cart(?:\\/|\\?|#|$)/i.test(window.location.pathname);
      if (onCartPage) {
        if (CART_ONLY_CHECKOUT_TEXTS[txt]) return true;
        if (
          txt.indexOf("checkout") !== -1 ||
          txt.indexOf("اتمام الطلب") !== -1 ||
          txt.indexOf("المتابعه للدفع") !== -1 ||
          txt.indexOf("انهاء التسوق") !== -1 ||
          txt.indexOf("اتمام الشراء") !== -1
        ) {
          return true;
        }
      }
      return false;
    }

    function notifyCheckoutBlocked() {
      var lang = detectCurrentLang();
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          { type: "niceone-demo-checkout-blocked", lang: lang },
          "*"
        );
      } else {
        window.alert(
          lang === "en"
            ? "Demo environment only by EraCoda. Please visit https://niceonesa.com/en to complete real orders."
            : "هذا الموقع للعرض والتجربة فقط من EraCoda. لإتمام الطلبات الفعلية يرجى زيارة الموقع الرسمي https://niceonesa.com/ar"
        );
      }
    }

    var notifyTimer = null;
    function notifyParent() {
      if (!window.parent || window.parent === window) return;
      if (notifyTimer) clearTimeout(notifyTimer);
      notifyTimer = setTimeout(function () {
        notifyTimer = null;
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
      }, 120);
    }

    var origPushState = history.pushState;
    history.pushState = function (_state, _title, url) {
      if (url && isCheckoutPath(url)) {
        notifyCheckoutBlocked();
        return;
      }
      var ret = origPushState.apply(this, arguments);
      setTimeout(notifyParent, 50);
      return ret;
    };

    var origReplaceState = history.replaceState;
    history.replaceState = function (_state, _title, url) {
      if (url && isCheckoutPath(url)) {
        notifyCheckoutBlocked();
        return;
      }
      var ret = origReplaceState.apply(this, arguments);
      setTimeout(notifyParent, 50);
      return ret;
    };

    document.addEventListener("DOMContentLoaded", notifyParent);
    window.addEventListener("load", notifyParent);
    window.addEventListener("hashchange", notifyParent);
    window.addEventListener("popstate", notifyParent);

    // 5. Client-side SPA navigation via Nuxt Vue Router + live Cart/Wishlist store refresh
    function getVueApp() {
      var nuxtEl = document.getElementById("__nuxt");
      return (nuxtEl && nuxtEl.__vue_app__) || (window.__NUXT__ && window.__NUXT__.vueApp) || null;
    }

    window.__niceoneSpaNavigate = function (targetUrl) {
      try {
        if (isCheckoutPath(targetUrl)) {
          notifyCheckoutBlocked();
          return true;
        }
        var curLang = (window.location.pathname.split("/")[1] || "").toLowerCase();
        var nextLang = (targetUrl.split("?")[0].split("#")[0].split("/")[1] || "").toLowerCase();
        if (curLang && nextLang && curLang !== nextLang) {
          return false;
        }
        var app = getVueApp();
        var router = app && app.config && app.config.globalProperties && app.config.globalProperties.$router;
        if (router && typeof router.push === "function") {
          Promise.resolve(router.push(targetUrl)).then(function () {
            setTimeout(notifyParent, 80);
            setTimeout(notifyParent, 400);
          }).catch(function () {});
          return true;
        }
      } catch (e) {}
      return false;
    };

    window.__niceoneRefreshStore = function () {
      try {
        var app = getVueApp();
        if (app && app._context && app._context.provides) {
          var provides = app._context.provides;
          var keys = Object.getOwnPropertyNames(provides).concat(
            typeof Object.getOwnPropertySymbols === "function"
              ? Object.getOwnPropertySymbols(provides)
              : []
          );
          for (var i = 0; i < keys.length; i++) {
            var val = provides[keys[i]];
            if (val && typeof val.invalidateQueries === "function") {
              val.invalidateQueries({ queryKey: ["cart"] });
              val.invalidateQueries({ queryKey: ["wishlist"] });
            }
          }
        }
      } catch (e) {}
    };

    window.addEventListener("message", function (ev) {
      if (ev.data && ev.data.type === "niceone-refresh-store") {
        window.__niceoneRefreshStore();
      }
    });

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

        // Intercept any Checkout button or Checkout link before Nuxt / login modal handles it
        var clickable = target.closest("button, a, [role='button'], .van-button");
        if (clickable && isCheckoutTriggerElement(clickable)) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof e.stopImmediatePropagation === "function") {
            e.stopImmediatePropagation();
          }
          notifyCheckoutBlocked();
          return;
        }

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
          if (isCheckoutPath(parsed.pathname)) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === "function") {
              e.stopImmediatePropagation();
            }
            notifyCheckoutBlocked();
            return;
          }
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
    const isCheckoutRoute = /(?:^|\/)checkout(?:\/|$)/i.test(localPath);
    const effectivePath = isCheckoutRoute ? `/${locale}/cart` : localPath;
    const shellHtml = buildHostShellHtml(
      locale,
      effectivePath,
      cleanSearch,
      isCheckoutRoute,
    );
    return new NextResponse(shellHtml, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Vary: "Sec-Fetch-Dest",
      },
    });
  }

  // Never proxy Nice One checkout pages inside the frame either
  if (/(?:^|\/)checkout(?:\/|$)/i.test(localPath)) {
    return new NextResponse(
      `<!DOCTYPE html><html><body><script>try{window.parent.postMessage({type:"niceone-demo-checkout-blocked",lang:${JSON.stringify(locale)}},"*");history.back();}catch(e){window.location.replace(${JSON.stringify(`/${locale}/cart?__frame=1`)});}</script></body></html>`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
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
