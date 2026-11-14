/**
 * Client-side Nice One store integration for the Chrome Extension.
 * Runs directly inside the shopper's browser on https://niceonesa.com
 * using their own browser cookies/session — zero server-side proxy traffic.
 */

const NICEONE_API_BASE = "https://api.niceonesa.com";
const NICEONE_HOST_RE = /(?:^|\.)niceonesa\.com$/i;

export type NiceOneRpcAction =
  | "add_to_cart"
  | "add_to_favourites"
  | "get_cart"
  | "get_favourites"
  | "remove_from_cart"
  | "remove_from_favourites";

interface BrowserCookies {
  session?: string;
  verifyToken?: string;
  userToken?: string;
  currency?: string;
}

let pendingSessionRefresh: Promise<void> | null = null;

export function isNiceOneHost(hostname?: string): boolean {
  const host =
    hostname ??
    (typeof window !== "undefined" ? window.location.hostname : "");
  return NICEONE_HOST_RE.test(host);
}

function readCookieMap(): Record<string, string> {
  if (typeof document === "undefined" || !document.cookie) return {};
  const map: Record<string, string> = {};
  for (const part of document.cookie.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = part.slice(0, eqIdx).trim();
    const rawVal = part.slice(eqIdx + 1).trim();
    if (!key) continue;
    try {
      map[key] = decodeURIComponent(rawVal);
    } catch {
      map[key] = rawVal;
    }
  }
  return map;
}

function readNiceOneCookies(): BrowserCookies {
  const cookies = readCookieMap();
  return {
    session: cookies["_session"],
    verifyToken: cookies["_verify_token"],
    userToken: cookies["_token"],
    currency: cookies["_currency"],
  };
}

function isVerifyTokenFresh(token?: string): boolean {
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return false;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    if (typeof payload.exp === "number") {
      return payload.exp * 1000 - Date.now() > 60_000;
    }
    return true;
  } catch {
    return false;
  }
}

async function ensureBrowserSession(forceRefresh = false): Promise<BrowserCookies> {
  const current = readNiceOneCookies();
  if (!isNiceOneHost()) {
    return current;
  }

  if (!forceRefresh && current.session && isVerifyTokenFresh(current.verifyToken)) {
    return current;
  }

  if (!pendingSessionRefresh) {
    pendingSessionRefresh = fetch("/api/session", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })
      .then(() => undefined)
      .catch((err) => {
        console.warn("[NiceOne Client API] Failed to refresh /api/session:", err);
      })
      .finally(() => {
        pendingSessionRefresh = null;
      });
  }

  await pendingSessionRefresh;
  return readNiceOneCookies();
}

function detectPageLang(explicitUrl?: string | null): "ar" | "en" {
  const target =
    explicitUrl ||
    (typeof window !== "undefined" ? window.location.pathname : "");
  if (/\/en(?:\/|\?|$)/i.test(target)) return "en";
  if (typeof document !== "undefined") {
    const htmlLang = document.documentElement?.lang?.toLowerCase() || "";
    if (htmlLang.startsWith("en")) return "en";
  }
  return "ar";
}

function buildBrowserApiHeaders(
  cookies: BrowserCookies,
  lang: "ar" | "en",
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    platform: "web",
    versionnumber: "5.6.0",
    "x-oc-currency": cookies.currency || "SAR",
    "x-oc-merchant-id": "2afc3973-04a5-4913-83f8-d45b0156b5f1",
    "x-oc-restadmin-id": "c15378d0-04f1-4d36-9af7-ab7e17da918b",
    "x-oc-merchant-language": lang,
    "web-layout":
      typeof window !== "undefined" && window.innerWidth < 768
        ? "mobile"
        : "laptop",
  };

  if (cookies.session) {
    headers["x-oc-session"] = cookies.session;
  }
  if (cookies.verifyToken) {
    headers["Verify-Token"] = cookies.verifyToken;
  }
  if (cookies.userToken) {
    headers["authorization"] = `Bearer ${cookies.userToken}`;
  }

  return headers;
}

async function fetchNiceOneClientApi(
  routeQuery: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    lang: "ar" | "en";
  },
): Promise<{ status: number; data: Record<string, unknown> }> {
  const method = options.method || "GET";
  const url = `${NICEONE_API_BASE}/?route=${routeQuery}`;
  let cookies = await ensureBrowserSession(false);

  const doRequest = (c: BrowserCookies) =>
    fetch(url, {
      method,
      headers: buildBrowserApiHeaders(c, options.lang),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: "include",
      cache: "no-store",
    });

  let res = await doRequest(cookies);
  if (res.status === 403 && isNiceOneHost()) {
    cookies = await ensureBrowserSession(true);
    res = await doRequest(cookies);
  }

  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }

  return { status: res.status, data };
}

function extractSiteError(data: Record<string, unknown>, fallback: string): string {
  const err = data?.error;
  if (typeof err === "string" && err.trim()) return err.trim();
  if (Array.isArray(err) && err.length > 0) {
    const first = err[0];
    if (typeof first === "string" && first.trim()) return first.trim();
    if (first && typeof first === "object") {
      const vals = Object.values(first as Record<string, unknown>);
      if (vals.length > 0 && typeof vals[0] === "string") return vals[0].trim();
    }
  }
  if (err && typeof err === "object") {
    const vals = Object.values(err as Record<string, unknown>);
    if (vals.length > 0 && typeof vals[0] === "string") return vals[0].trim();
  }
  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message.trim();
  }
  return fallback;
}

function mapCartError(rawError: string): string {
  const lower = rawError.toLowerCase();
  if (
    rawError.includes("غير متوفر") ||
    rawError.includes("نفذ") ||
    rawError.includes("لا تتوفر") ||
    lower.includes("out of stock") ||
    lower.includes("not available") ||
    lower.includes("stock")
  ) {
    return "out_of_stock";
  }
  if (
    rawError.includes("خيار") ||
    rawError.includes("حجم") ||
    rawError.includes("لون") ||
    rawError.includes("مطلوب") ||
    lower.includes("option") ||
    lower.includes("required")
  ) {
    return "option_required";
  }
  if (
    rawError.includes("الحد الأقصى") ||
    rawError.includes("أقصى كمية") ||
    rawError.includes("الكمية المسموحة") ||
    lower.includes("maximum") ||
    lower.includes("max quantity") ||
    lower.includes("limit")
  ) {
    return "max_quantity";
  }
  return rawError;
}

async function resolveOptionPayload(
  productId: number,
  option: Record<string, unknown> | null | undefined,
  lang: "ar" | "en",
): Promise<Record<string, string>> {
  if (!option || typeof option !== "object") {
    return {};
  }

  const prodOptId = option.product_option_id;
  const prodOptValueId = option.product_option_value_id;
  const prodOptVariantId = option.product_option_variant_id;
  const optSku = typeof option.sku === "string" ? option.sku.trim().toLowerCase() : "";
  const optName = typeof option.name === "string" ? option.name.trim() : "";

  if (prodOptId !== undefined && prodOptValueId !== undefined) {
    return { [String(prodOptId)]: String(prodOptValueId) };
  }

  try {
    const { data } = await fetchNiceOneClientApi(
      `rest/product_admin/products&id=${encodeURIComponent(String(productId))}`,
      { method: "GET", lang },
    );
    const dataObj = (data?.data || {}) as Record<string, unknown>;
    const productObj = (dataObj?.product || dataObj) as Record<string, unknown>;
    const optionsList = Array.isArray(productObj?.options)
      ? (productObj.options as Array<Record<string, unknown>>)
      : [];

    for (const opt of optionsList) {
      const currentOptId = opt.product_option_id;
      if (
        prodOptId !== undefined &&
        prodOptId !== null &&
        String(currentOptId) !== String(prodOptId)
      ) {
        continue;
      }

      const values = Array.isArray(opt.option_value)
        ? (opt.option_value as Array<Record<string, unknown>>)
        : [];

      const matched =
        values.find(
          (v) =>
            prodOptVariantId !== undefined &&
            prodOptVariantId !== null &&
            Number(v.product_option_variant_id) === Number(prodOptVariantId),
        ) ||
        values.find(
          (v) =>
            optSku &&
            typeof v.sku === "string" &&
            v.sku.trim().toLowerCase() === optSku,
        ) ||
        values.find(
          (v) =>
            optName &&
            (v.name === optName ||
              v.en_name === optName ||
              String(v.name || "").replace(/\s+/g, "") ===
                optName.replace(/\s+/g, "")),
        );

      if (matched && matched.product_option_value_id !== undefined) {
        return {
          [String(currentOptId)]: String(matched.product_option_value_id),
        };
      }
    }

    for (const opt of optionsList) {
      const currentOptId = opt.product_option_id;
      const values = Array.isArray(opt.option_value)
        ? (opt.option_value as Array<Record<string, unknown>>)
        : [];
      const matched =
        values.find(
          (v) =>
            prodOptVariantId !== undefined &&
            prodOptVariantId !== null &&
            Number(v.product_option_variant_id) === Number(prodOptVariantId),
        ) ||
        values.find(
          (v) =>
            optSku &&
            typeof v.sku === "string" &&
            v.sku.trim().toLowerCase() === optSku,
        );
      if (matched && matched.product_option_value_id !== undefined) {
        return {
          [String(currentOptId)]: String(matched.product_option_value_id),
        };
      }
    }
  } catch (err) {
    console.warn("[NiceOne Client API] Failed to resolve product option:", err);
  }

  if (prodOptId !== undefined && prodOptVariantId !== undefined) {
    return { [String(prodOptId)]: String(prodOptVariantId) };
  }

  return {};
}

interface VueAppLike {
  config?: {
    globalProperties?: {
      $router?: {
        push?: (to: string) => Promise<unknown> | unknown;
      };
    };
  };
  _context?: {
    provides?: Record<PropertyKey, unknown>;
  };
}

function getNiceOneVueApp(): VueAppLike | null {
  if (typeof document === "undefined") return null;
  const nuxtEl = document.getElementById("__nuxt") as
    | (HTMLElement & { __vue_app__?: VueAppLike })
    | null;
  if (nuxtEl?.__vue_app__) return nuxtEl.__vue_app__;
  const win = window as unknown as { __NUXT__?: { vueApp?: VueAppLike } };
  return win.__NUXT__?.vueApp || null;
}

/**
 * Invalidates Nuxt's TanStack Query caches on niceonesa.com so the cart badge
 * and wishlist heart states update immediately without reloading the page.
 */
export function refreshNiceOneStore(
  type: "cart" | "wishlist" | "all" = "all",
): void {
  try {
    const app = getNiceOneVueApp();
    const provides = app?._context?.provides;
    if (!provides) return;

    const keys: PropertyKey[] = [
      ...Object.getOwnPropertyNames(provides),
      ...(typeof Object.getOwnPropertySymbols === "function"
        ? Object.getOwnPropertySymbols(provides)
        : []),
    ];

    for (const key of keys) {
      const val = provides[key] as {
        invalidateQueries?: (opts: { queryKey: string[] }) => void;
      } | null;
      if (val && typeof val.invalidateQueries === "function") {
        if (type === "cart" || type === "all") {
          val.invalidateQueries({ queryKey: ["cart"] });
        }
        if (type === "wishlist" || type === "all") {
          val.invalidateQueries({ queryKey: ["wishlist"] });
        }
      }
    }
  } catch (err) {
    console.warn("[NiceOne Client API] Store refresh skipped:", err);
  }
}

/**
 * Navigates smoothly on niceonesa.com using Nuxt's Vue Router when staying on
 * the same locale (/ar or /en), keeping the LiveKit voice call alive.
 */
export function navigateNiceOneSpa(rawRoute: string): boolean {
  if (typeof window === "undefined" || !isNiceOneHost()) return false;

  let targetPath = rawRoute.trim();
  if (!targetPath) return false;

  if (targetPath.startsWith("http://") || targetPath.startsWith("https://")) {
    try {
      const parsed = new URL(targetPath);
      if (!isNiceOneHost(parsed.hostname)) {
        window.location.href = targetPath;
        return true;
      }
      targetPath = `${parsed.pathname || "/"}${parsed.search || ""}${parsed.hash || ""}`;
    } catch {
      return false;
    }
  } else if (!targetPath.startsWith("/")) {
    targetPath = `/${targetPath}`;
  }

  try {
    const curLocale = (window.location.pathname.split("/")[1] || "").toLowerCase();
    const nextLocale = (
      targetPath.split("?")[0].split("#")[0].split("/")[1] || ""
    ).toLowerCase();
    const isLocaleSwitch =
      (curLocale === "ar" || curLocale === "en") &&
      (nextLocale === "ar" || nextLocale === "en") &&
      curLocale !== nextLocale;

    if (!isLocaleSwitch) {
      const router = getNiceOneVueApp()?.config?.globalProperties?.$router;
      if (router && typeof router.push === "function") {
        Promise.resolve(router.push(targetPath)).catch(() => {
          window.location.href = targetPath;
        });
        return true;
      }
    }
  } catch {
    // Fall back to location assignment below
  }

  window.location.href = targetPath;
  return true;
}

export async function executeNiceOneRpc(
  action: NiceOneRpcAction,
  payload: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  if (typeof window === "undefined" || !isNiceOneHost()) {
    return {
      success: false,
      error: "Nice One store actions require running on niceonesa.com via the extension",
    };
  }

  const lang = detectPageLang(
    typeof payload.url === "string" ? payload.url : null,
  );

  if (action === "add_to_cart") {
    const productId = Number(payload.product_id);
    if (!productId || Number.isNaN(productId)) {
      return { success: false, error: "Invalid product_id" };
    }

    const quantity = Math.max(1, Math.min(10, Number(payload.quantity || 1)));
    const rawOption =
      payload.option && typeof payload.option === "object"
        ? (payload.option as Record<string, unknown>)
        : null;

    const resolvedOption = await resolveOptionPayload(productId, rawOption, lang);

    const { data } = await fetchNiceOneClientApi("rest/cart/cart", {
      method: "POST",
      lang,
      body: {
        product_id: String(productId),
        quantity: String(quantity),
        option: resolvedOption,
      },
    });

    const isOk = data?.success === 1 || data?.success === true;
    if (!isOk) {
      const rawErr = extractSiteError(data, "out_of_stock");
      return {
        success: false,
        error: mapCartError(rawErr),
      };
    }

    const cartObj = (
      (data?.data as Record<string, unknown> | undefined)?.cart || {}
    ) as Record<string, unknown>;
    const cartCount =
      typeof cartObj.total_product_count === "number"
        ? cartObj.total_product_count
        : Number(cartObj.total_product_count || 0);

    refreshNiceOneStore("cart");

    return {
      success: true,
      ...(Number.isFinite(cartCount) ? { cart_count: cartCount } : {}),
    };
  }

  if (action === "add_to_favourites") {
    const productId = Number(payload.product_id);
    if (!productId || Number.isNaN(productId)) {
      return { success: false, error: "Invalid product_id" };
    }

    const currentWish = await fetchNiceOneClientApi("rest/wishlist/wishlist", {
      method: "GET",
      lang,
    });

    if (currentWish.status === 401) {
      return { success: false, error: "login_required" };
    }

    const currentProducts = Array.isArray(
      (currentWish.data?.data as Record<string, unknown> | undefined)?.products,
    )
      ? ((currentWish.data.data as Record<string, unknown>).products as Array<
          Record<string, unknown>
        >)
      : [];

    const alreadyExists = currentProducts.some(
      (p) => Number(p.product_id ?? p.id) === productId,
    );

    if (alreadyExists) {
      return { success: true, already: true };
    }

    const { status, data } = await fetchNiceOneClientApi(
      "rest/wishlist/wishlist",
      {
        method: "POST",
        lang,
        body: {
          product_id: productId,
          option: {},
        },
      },
    );

    if (status === 401) {
      return { success: false, error: "login_required" };
    }

    const isOk = data?.success === 1 || data?.success === true;
    if (!isOk) {
      const rawErr = extractSiteError(data, "Failed to add to favourites");
      const isLoginErr =
        rawErr.includes("تسجيل الدخول") ||
        rawErr.toLowerCase().includes("login") ||
        rawErr.toLowerCase().includes("unauthenticated");
      return {
        success: false,
        error: isLoginErr ? "login_required" : rawErr,
      };
    }

    refreshNiceOneStore("wishlist");

    return {
      success: true,
      already: false,
    };
  }

  if (action === "get_cart") {
    const { data } = await fetchNiceOneClientApi("rest/cart/cart", {
      method: "GET",
      lang,
    });

    const cartObj = (
      (data?.data as Record<string, unknown> | undefined)?.cart || {}
    ) as Record<string, unknown>;
    const cartProductsGroups = (cartObj.cart_products || {}) as Record<
      string,
      { products?: Array<Record<string, unknown>> }
    >;

    const rawProducts: Array<Record<string, unknown>> = [];
    for (const group of Object.values(cartProductsGroups)) {
      if (group && Array.isArray(group.products)) {
        rawProducts.push(...group.products);
      }
    }

    const items = rawProducts.map((p) => {
      const opts = Array.isArray(p.option)
        ? (p.option as Array<Record<string, unknown>>)
        : [];
      const firstOpt = opts[0];
      const optionLabel = firstOpt
        ? String(firstOpt.value || firstOpt.name || firstOpt.en_name || "").trim()
        : "";

      const priceVal = Number(p.price ?? p.event_price ?? 0);
      const qtyVal = Number(p.quantity ?? 1);

      const item: Record<string, unknown> = {
        product_id: Number(p.product_id),
        name: String(p.name || p.en_name || "").trim(),
        quantity: Number.isFinite(qtyVal) && qtyVal > 0 ? qtyVal : 1,
        price: Number.isFinite(priceVal) ? priceVal : 0,
      };
      if (optionLabel) {
        item.option = optionLabel;
      }
      return item;
    });

    const totalVal = Number(cartObj.total_raw ?? 0);

    return {
      success: true,
      items,
      total: Number.isFinite(totalVal) ? totalVal : 0,
    };
  }

  if (action === "get_favourites") {
    const { status, data } = await fetchNiceOneClientApi(
      "rest/wishlist/wishlist",
      {
        method: "GET",
        lang,
      },
    );

    if (status === 401) {
      return { success: false, error: "login_required" };
    }

    const wishData = (data?.data || {}) as Record<string, unknown>;
    const rawProducts = Array.isArray(wishData.products)
      ? (wishData.products as Array<Record<string, unknown>>)
      : [];

    const items = rawProducts
      .map((p) => ({
        product_id: Number(p.product_id ?? p.id),
        name: String(
          (lang === "en" ? p.en_name || p.name : p.name || p.en_name) || "",
        ).trim(),
      }))
      .filter((item) => item.product_id && !Number.isNaN(item.product_id));

    return {
      success: true,
      items,
    };
  }

  if (action === "remove_from_cart") {
    const productId = Number(payload.product_id);
    if (!productId || Number.isNaN(productId)) {
      return { success: false, error: "not_in_cart" };
    }

    const rawOpt = payload.option;
    const optFilter =
      typeof rawOpt === "string"
        ? rawOpt.replace(/\s+/g, "").toLowerCase()
        : rawOpt &&
            typeof rawOpt === "object" &&
            typeof (rawOpt as Record<string, unknown>).name === "string"
          ? String((rawOpt as Record<string, unknown>).name)
              .replace(/\s+/g, "")
              .toLowerCase()
          : "";

    const currentCart = await fetchNiceOneClientApi("rest/cart/cart", {
      method: "GET",
      lang,
    });

    const cartObj = (
      (currentCart.data?.data as Record<string, unknown> | undefined)?.cart || {}
    ) as Record<string, unknown>;
    const cartProductsGroups = (cartObj.cart_products || {}) as Record<
      string,
      { products?: Array<Record<string, unknown>> }
    >;

    const rawProducts: Array<Record<string, unknown>> = [];
    for (const group of Object.values(cartProductsGroups)) {
      if (group && Array.isArray(group.products)) {
        rawProducts.push(...group.products);
      }
    }

    const productLines = rawProducts.filter(
      (p) => Number(p.product_id) === productId,
    );

    if (productLines.length === 0) {
      return { success: false, error: "not_in_cart" };
    }

    let targetLine = productLines[0];
    if (optFilter && productLines.length > 1) {
      const matchedByOpt = productLines.find((p) => {
        const opts = Array.isArray(p.option)
          ? (p.option as Array<Record<string, unknown>>)
          : [];
        return opts.some((o) => {
          const val = String(o.value || o.name || o.en_name || "")
            .replace(/\s+/g, "")
            .toLowerCase();
          return val && (val.includes(optFilter) || optFilter.includes(val));
        });
      });
      if (matchedByOpt) {
        targetLine = matchedByOpt;
      }
    }

    const lineKey = String(targetLine.key || "");
    if (!lineKey) {
      return { success: false, error: "not_in_cart" };
    }

    const delRes = await fetchNiceOneClientApi("rest/cart/cart", {
      method: "DELETE",
      lang,
      body: { key: lineKey },
    });

    const isOk = delRes.data?.success === 1 || delRes.data?.success === true;
    if (!isOk) {
      return {
        success: false,
        error: extractSiteError(delRes.data, "not_in_cart"),
      };
    }

    const updatedCartObj = (
      (delRes.data?.data as Record<string, unknown> | undefined)?.cart || {}
    ) as Record<string, unknown>;
    const cartCount = Number(updatedCartObj.total_product_count ?? 0);

    refreshNiceOneStore("cart");

    return {
      success: true,
      cart_count: Number.isFinite(cartCount) ? cartCount : 0,
    };
  }

  if (action === "remove_from_favourites") {
    const productId = Number(payload.product_id);
    if (!productId || Number.isNaN(productId)) {
      return { success: false, error: "not_in_list" };
    }

    const currentWish = await fetchNiceOneClientApi("rest/wishlist/wishlist", {
      method: "GET",
      lang,
    });

    if (currentWish.status === 401) {
      return { success: false, error: "login_required" };
    }

    const currentProducts = Array.isArray(
      (currentWish.data?.data as Record<string, unknown> | undefined)?.products,
    )
      ? ((currentWish.data.data as Record<string, unknown>).products as Array<
          Record<string, unknown>
        >)
      : [];

    const existsInWish = currentProducts.some(
      (p) => Number(p.product_id ?? p.id) === productId,
    );

    if (!existsInWish) {
      return { success: false, error: "not_in_list" };
    }

    const delRes = await fetchNiceOneClientApi(
      `rest/wishlist/wishlist&id=${encodeURIComponent(String(productId))}`,
      {
        method: "DELETE",
        lang,
        body: { product_id: productId },
      },
    );

    const isOk = delRes.data?.success === 1 || delRes.data?.success === true;
    if (!isOk) {
      return {
        success: false,
        error: extractSiteError(delRes.data, "not_in_list"),
      };
    }

    refreshNiceOneStore("wishlist");

    return { success: true };
  }

  return { success: false, error: `Unknown RPC action: ${action}` };
}
