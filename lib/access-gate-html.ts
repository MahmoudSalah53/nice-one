/**
 * HTML for the password-protected access gate (rendered by middleware.ts).
 * Kept self-contained (inline CSS/JS) so it works before any app route loads.
 */
export function buildGateHtml(): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
  <link rel="icon" href="/eracoda-icon.svg" type="image/svg+xml" />
  <title>EraCoda — Demo</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html {
      min-height: 100%;
      background-color: #0b1424;
      background-image:
        radial-gradient(ellipse 70% 45% at 50% 0%, rgba(240, 165, 40, 0.08) 0%, transparent 70%),
        linear-gradient(180deg, #101c33 0%, #0a1222 100%);
      background-attachment: fixed;
      background-repeat: no-repeat;
    }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      background: transparent;
      color: #e2e8f0;
      font-family: system-ui, -apple-system, "Segoe UI", Tahoma, Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .wrap {
      width: 100%;
      max-width: 620px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .logo {
      height: 32px;
      width: auto;
      margin-bottom: 22px;
    }
    .notice {
      margin: 0 0 24px;
      font-size: 14.5px;
      line-height: 1.9;
      color: #94a3b8;
    }
    .notice strong {
      color: #e2e8f0;
      font-weight: 600;
    }
    .notice a {
      color: #f0a528;
      font-weight: 600;
      text-decoration: none;
      direction: ltr;
      unicode-bidi: isolate;
    }
    .notice a:hover { text-decoration: underline; }
    .privacy-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 20px 0 0;
      padding: 9px 16px;
      border-radius: 10px;
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.25);
      color: #e2e8f0;
      font-size: 13.5px;
      line-height: 1.65;
    }
    .privacy-badge svg {
      color: #34d399;
      flex: 0 0 auto;
    }
    .privacy-badge strong {
      color: #6ee7b7;
      font-weight: 600;
    }
    .card {
      width: 100%;
      max-width: 380px;
      text-align: right;
      background: rgba(255, 255, 255, 0.035);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 24px 22px 20px;
    }
    label.lbl {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #cbd5e1;
      margin-bottom: 8px;
    }
    .field { position: relative; margin-bottom: 14px; }
    .field input {
      width: 100%;
      height: 44px;
      padding: 0 42px 0 12px;
      border-radius: 9px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(7, 12, 22, 0.6);
      color: #f8fafc;
      font-size: 15px;
      direction: ltr;
      text-align: left;
      outline: none;
      transition: border-color .15s, box-shadow .15s;
    }
    .field input::placeholder { color: #475569; }
    .field input:focus {
      border-color: rgba(240, 165, 40, 0.6);
      box-shadow: 0 0 0 3px rgba(240, 165, 40, 0.12);
    }
    .eye {
      position: absolute;
      top: 50%;
      right: 8px;
      transform: translateY(-50%);
      border: 0;
      background: transparent;
      color: #64748b;
      padding: 6px;
      cursor: pointer;
      display: flex;
    }
    .eye:hover { color: #cbd5e1; }
    .consent {
      display: flex;
      align-items: center;
      gap: 9px;
      margin: 4px 0 18px;
      font-size: 13px;
      color: #94a3b8;
      cursor: pointer;
      user-select: none;
    }
    .consent input {
      width: 16px;
      height: 16px;
      margin: 0;
      accent-color: #f0a528;
      cursor: pointer;
      flex: 0 0 auto;
    }
    .consent.warn { color: #fca5a5; }
    .btn {
      width: 100%;
      height: 44px;
      border: 0;
      border-radius: 9px;
      background: #f8fafc;
      color: #0b1424;
      font-size: 14.5px;
      font-weight: 600;
      cursor: pointer;
      transition: background .15s, opacity .15s;
    }
    .btn:hover:not(:disabled) { background: #ffffff; }
    .btn:disabled { opacity: .35; cursor: not-allowed; }
    .err {
      margin-top: 10px;
      font-size: 12.5px;
      color: #fca5a5;
      text-align: center;
    }
    .err:empty { display: none; }
  </style>
</head>
<body>
  <div class="wrap">
    <img class="logo" src="/eracoda-logo-dark.png" alt="EraCoda" />

    <p class="notice">
      هذه <strong>بيئة عرض تقنية</strong> من EraCoda لتجربة المساعد الصوتي، وليست الموقع الرسمي لمتجر نايس ون.<br />
      للتسوق وإتمام الطلبات يُرجى زيارة الموقع الرسمي <a href="https://niceonesa.com" target="_blank" rel="noopener noreferrer">niceonesa.com</a>
    </p>

    <form class="card" id="f" autocomplete="off" novalidate>
      <label class="lbl" for="pw">كلمة المرور</label>
      <div class="field">
        <input id="pw" type="password" placeholder="••••••••" autocomplete="off" autofocus />
        <button type="button" class="eye" id="eye" aria-label="إظهار كلمة المرور">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>

      <label class="consent" id="cr">
        <input id="ok" type="checkbox" />
        <span>اطلعت على التنويه وأوافق على المتابعة</span>
      </label>

      <button class="btn" id="btn" type="submit" disabled>دخول</button>
      <div class="err" id="err" role="alert"></div>
    </form>

    <div class="privacy-badge">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <path d="m9 12 2 2 4-4"/>
      </svg>
      <span><strong>تنويه الخصوصية:</strong> لا نقوم بسحب أو حفظ أي بيانات خاصة، ولا نملك أي صلاحية وصول سوى للبيانات العامة المتاحة للعميل على الصفحة فقط.</span>
    </div>
  </div>

  <script>
    (function () {
      var f = document.getElementById("f");
      var pw = document.getElementById("pw");
      var ok = document.getElementById("ok");
      var cr = document.getElementById("cr");
      var btn = document.getElementById("btn");
      var err = document.getElementById("err");
      var busy = false;

      function sync() {
        if (ok.checked) cr.classList.remove("warn");
        btn.disabled = busy || !pw.value.trim() || !ok.checked;
      }
      pw.addEventListener("input", function () { err.textContent = ""; sync(); });
      ok.addEventListener("change", function () { err.textContent = ""; sync(); });
      document.getElementById("eye").addEventListener("click", function () {
        pw.type = pw.type === "password" ? "text" : "password";
        pw.focus();
      });

      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var code = pw.value.trim();
        if (!code) { pw.focus(); return; }
        if (!ok.checked) { cr.classList.add("warn"); return; }

        busy = true; sync();
        btn.textContent = "جاري التحقق...";
        err.textContent = "";

        fetch("/__auth/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ password: code, accepted: true })
        })
          .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
          .then(function (res) {
            if (res.ok && res.d && res.d.ok) { window.location.reload(); return; }
            busy = false;
            btn.textContent = "دخول";
            err.textContent = (res.d && res.d.error) || "كلمة المرور غير صحيحة";
            sync();
            pw.select();
          })
          .catch(function () {
            busy = false;
            btn.textContent = "دخول";
            err.textContent = "تعذر الاتصال، حاول مرة أخرى";
            sync();
          });
      });

      sync();
    })();
  </script>
</body>
</html>`;
}
