import { NextResponse } from "next/server";
import { getNiceOneSession, NiceOneSessionData } from "@/lib/niceone-proxy";

export const dynamic = "force-dynamic";

const NICEONE_API_BASE = "https://api.niceonesa.com";

function detectLang(url?: string | null, referer?: string | null): "ar" | "en" {
  const target = url || referer || "";
  if (/\/en(?:\/|\?|$)/i.test(target)) return "en";
  return "ar";
}

function buildUpstreamHeaders(
  sessionData: NiceOneSessionData,
  lang: "ar" | "en",
  userAgent?: string | null,
): Record<string, string> {
  const headers: Record<string, string> = {
    Origin: "https://niceonesa.com",
    Referer: "https://niceonesa.com/",
    "User-Agent":
      userAgent ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    platform: "web",
    versionnumber: "5.6.0",
    "x-oc-currency": "SAR",
    "x-oc-merchant-id": "2afc3973-04a5-4913-83f8-d45b0156b5f1",
    "x-oc-restadmin-id": "c15378d0-04f1-4d36-9af7-ab7e17da918b",
    "x-oc-merchant-language": lang,
    "web-layout": "laptop",
  };

  if (sessionData.session) {
    headers["x-oc-session"] = sessionData.session;
  }
  if (sessionData.verifyToken) {
    headers["Verify-Token"] = sessionData.verifyToken;
  }

  return headers;
}

async function fetchNiceOneApi(
  routeQuery: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    lang: "ar" | "en";
    incomingCookie?: string | null;
    userAgent?: string | null;
  },
): Promise<{ status: number; data: Record<string, unknown>; sessionData: NiceOneSessionData }> {
  const method = options.method || "GET";
  const url = `${NICEONE_API_BASE}/?route=${routeQuery}`;
  let sessionData = await getNiceOneSession(false, options.incomingCookie);

  const doRequest = async (sData: NiceOneSessionData) => {
    const headers = buildUpstreamHeaders(sData, options.lang, options.userAgent);
    return fetch(url, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
  };

  let res = await doRequest(sessionData);
  if (res.status === 403) {
    sessionData = await getNiceOneSession(true, options.incomingCookie);
    res = await doRequest(sessionData);
  }

  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }

  return { status: res.status, data, sessionData };
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
  incomingCookie?: string | null,
  userAgent?: string | null,
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

  // Look up product options from Nice One API to map product_option_variant_id -> product_option_value_id
  try {
    const { data } = await fetchNiceOneApi(
      `rest/product_admin/products&id=${encodeURIComponent(String(productId))}`,
      { method: "GET", lang, incomingCookie, userAgent },
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

    // Second pass without product_option_id restriction if not matched
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
    console.warn("[NiceOne RPC] Failed to resolve product option value id:", err);
  }

  if (prodOptId !== undefined && prodOptVariantId !== undefined) {
    return { [String(prodOptId)]: String(prodOptVariantId) };
  }

  return {};
}

function attachSessionCookies(res: NextResponse, sessionData: NiceOneSessionData) {
  if (sessionData.session) {
    res.headers.append(
      "Set-Cookie",
      `_session=${encodeURIComponent(sessionData.session)}; Path=/; Max-Age=604800; SameSite=Lax`,
    );
  }
  if (sessionData.verifyToken) {
    res.headers.append(
      "Set-Cookie",
      `_verify_token=${encodeURIComponent(sessionData.verifyToken)}; Path=/; Max-Age=300; SameSite=Lax`,
    );
  }
  return res;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: string;
      payload?: Record<string, unknown>;
    };
    const action = body?.action;
    const payload = body?.payload || {};
    const incomingCookie = request.headers.get("cookie");
    const userAgent = request.headers.get("user-agent");
    const referer = request.headers.get("referer");
    const lang = detectLang(
      typeof payload.url === "string" ? payload.url : null,
      referer,
    );

    if (action === "add_to_cart") {
      const productId = Number(payload.product_id);
      if (!productId || Number.isNaN(productId)) {
        return NextResponse.json({
          success: false,
          error: "Invalid product_id",
        });
      }

      const quantity = Math.max(1, Math.min(10, Number(payload.quantity || 1)));
      const rawOption =
        payload.option && typeof payload.option === "object"
          ? (payload.option as Record<string, unknown>)
          : null;

      const resolvedOption = await resolveOptionPayload(
        productId,
        rawOption,
        lang,
        incomingCookie,
        userAgent,
      );

      const { data, sessionData } = await fetchNiceOneApi("rest/cart/cart", {
        method: "POST",
        lang,
        incomingCookie,
        userAgent,
        body: {
          product_id: String(productId),
          quantity: String(quantity),
          option: resolvedOption,
        },
      });

      const isOk = data?.success === 1 || data?.success === true;
      if (!isOk) {
        const rawErr = extractSiteError(data, "out_of_stock");
        return attachSessionCookies(
          NextResponse.json({
            success: false,
            error: mapCartError(rawErr),
          }),
          sessionData,
        );
      }

      const cartObj = (
        (data?.data as Record<string, unknown> | undefined)?.cart || {}
      ) as Record<string, unknown>;
      const cartCount =
        typeof cartObj.total_product_count === "number"
          ? cartObj.total_product_count
          : Number(cartObj.total_product_count || 0);

      return attachSessionCookies(
        NextResponse.json({
          success: true,
          ...(Number.isFinite(cartCount) ? { cart_count: cartCount } : {}),
        }),
        sessionData,
      );
    }

    if (action === "add_to_favourites") {
      const productId = Number(payload.product_id);
      if (!productId || Number.isNaN(productId)) {
        return NextResponse.json({
          success: false,
          error: "Invalid product_id",
        });
      }

      // First check if product is already in wishlist so we don't toggle it off
      const currentWish = await fetchNiceOneApi("rest/wishlist/wishlist", {
        method: "GET",
        lang,
        incomingCookie,
        userAgent,
      });

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
        return attachSessionCookies(
          NextResponse.json({
            success: true,
            already: true,
          }),
          currentWish.sessionData,
        );
      }

      const { status, data, sessionData } = await fetchNiceOneApi(
        "rest/wishlist/wishlist",
        {
          method: "POST",
          lang,
          incomingCookie,
          userAgent,
          body: {
            product_id: productId,
            option: {},
          },
        },
      );

      if (status === 401) {
        return attachSessionCookies(
          NextResponse.json({
            success: false,
            error: "login_required",
          }),
          sessionData,
        );
      }

      const isOk = data?.success === 1 || data?.success === true;
      if (!isOk) {
        const rawErr = extractSiteError(data, "Failed to add to favourites");
        const isLoginErr =
          rawErr.includes("تسجيل الدخول") ||
          rawErr.toLowerCase().includes("login") ||
          rawErr.toLowerCase().includes("unauthenticated");
        return attachSessionCookies(
          NextResponse.json({
            success: false,
            error: isLoginErr ? "login_required" : rawErr,
          }),
          sessionData,
        );
      }

      return attachSessionCookies(
        NextResponse.json({
          success: true,
          already: false,
        }),
        sessionData,
      );
    }

    if (action === "get_cart") {
      const { data, sessionData } = await fetchNiceOneApi("rest/cart/cart", {
        method: "GET",
        lang,
        incomingCookie,
        userAgent,
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

      return attachSessionCookies(
        NextResponse.json({
          success: true,
          items,
          total: Number.isFinite(totalVal) ? totalVal : 0,
        }),
        sessionData,
      );
    }

    if (action === "get_favourites") {
      const { status, data, sessionData } = await fetchNiceOneApi(
        "rest/wishlist/wishlist",
        {
          method: "GET",
          lang,
          incomingCookie,
          userAgent,
        },
      );

      if (status === 401) {
        return attachSessionCookies(
          NextResponse.json({
            success: false,
            error: "login_required",
          }),
          sessionData,
        );
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

      return attachSessionCookies(
        NextResponse.json({
          success: true,
          items,
        }),
        sessionData,
      );
    }

    return NextResponse.json(
      { success: false, error: `Unknown RPC action: ${action}` },
      { status: 400 },
    );
  } catch (error) {
    console.error("[NiceOne RPC API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal RPC error",
      },
      { status: 500 },
    );
  }
}
