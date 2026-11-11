/**
 * RPC method handlers for agent-client
 * These handlers process RPC calls from the backend agent and execute actions via SiteAutomation
 * In iframe mode, actions are proxied to the parent page via postMessage
 */

import SiteAutomation from "@/utils/siteAutomation";
import {
  selectStations,
  setTripTypeAndDateISO,
  setPassengers,
} from "@/utils/custom";

const bookingStepDelay = (ms: number) =>
  new Promise<void>((r) => setTimeout(r, ms));

// Extend Window for iframe bridge types
declare global {
  interface Window {
    __iframeMode: boolean;
    __executeParentAction: (
      action: string,
      data: Record<string, unknown>,
    ) => Promise<{ success: boolean; error?: string }>;
  }
}

const parsePayload = (data: { payload?: string | unknown }) => {
  return typeof data.payload === "string"
    ? JSON.parse(data.payload)
    : data.payload;
};

const createErrorResponse = (error: string) =>
  JSON.stringify({ success: false, error });

const createSuccessResponse = (data: Record<string, unknown>) =>
  JSON.stringify({ success: true, ...data });

/**
 * Check if running in iframe mode
 */
const isIframeMode = () => {
  return typeof window !== "undefined" && window.__iframeMode === true;
};

/**
 * Execute action - handles both normal mode and iframe mode
 */
async function executeAction(
  action: string,
  data: Record<string, unknown>,
  normalModeExecutor: () => boolean,
): Promise<{ success: boolean; error?: string }> {
  if (isIframeMode()) {
    console.log(`[RPC HANDLER] Executing ${action} via iframe bridge`);
    if (typeof window.__executeParentAction === "function") {
      return window.__executeParentAction(action, data);
    }
    return { success: false, error: "Iframe bridge not available" };
  }

  // Normal mode - execute directly
  const success = normalModeExecutor();
  return { success, error: success ? undefined : `${action} failed` };
}

export const rpcHandlers = {
  navigate: async (data: { payload?: string | unknown }) => {
    const logPrefix = "[NAVIGATION RPC]";
    console.log(`${logPrefix} 🔵 navigate RPC method handler called!`);
    console.log(`${logPrefix} RPC data received:`, data);

    try {
      const payload = parsePayload(data);
      console.log(`${logPrefix} Parsed payload:`, payload);
      // Accept both "route" and "url" as valid keys
      const route = payload?.route || payload?.url || payload;

      if (!route || typeof route !== "string") {
        console.error(`${logPrefix} Invalid route provided:`, payload);
        return createErrorResponse(
          "Invalid route. Use {route: '...'} or {url: '...'}",
        );
      }

      console.log(
        `${logPrefix} ✅ Received navigate RPC call with route:`,
        route,
      );

      const result = await executeAction("navigate", { url: route }, () => {
        if (typeof SiteAutomation.navigate !== "function") {
          console.error("SiteAutomation.navigate method not found");
          return false;
        }
        return SiteAutomation.navigate(route);
      });

      if (result.success) {
        console.log("Navigation successful to:", route);
        return createSuccessResponse({ route });
      } else {
        console.error("Navigation failed for route:", route);
        return createErrorResponse(result.error || "Navigation failed");
      }
    } catch (error) {
      console.error(`${logPrefix} Error processing navigate RPC call:`, error);
      return createErrorResponse(
        error instanceof Error ? error.message : String(error),
      );
    }
  },

  click_button: async (data: { payload?: string | unknown }) => {
    const logPrefix = "[CLICK BUTTON RPC]";
    console.log(`${logPrefix} 🔵 click_button RPC method handler called!`);
    console.log(`${logPrefix} RPC data received:`, data);

    try {
      const payload = parsePayload(data);
      console.log(`${logPrefix} Parsed payload:`, payload);
      const rawJsid = payload?.jsid ?? payload?.jsId ?? payload;
      const jsid =
        typeof rawJsid === "number" ? String(rawJsid) : rawJsid;

      if (!jsid || typeof jsid !== "string") {
        console.error(`${logPrefix} Invalid jsid provided:`, payload);
        return createErrorResponse("Element not found");
      }

      console.log(
        `${logPrefix} ✅ Received click_button RPC call with jsid:`,
        jsid,
      );

      const result = await executeAction("click_button", { jsId: jsid }, () => {
        if (typeof SiteAutomation.click_button !== "function") {
          console.error("SiteAutomation.click_button method not found");
          return false;
        }
        return SiteAutomation.click_button(jsid);
      });

      if (result.success) {
        console.log("Button click successful for jsid:", jsid);
        return createSuccessResponse({});
      } else {
        console.error("Button click failed for jsid:", jsid);
        const errMsg =
          result.error === "Button is disabled"
            ? "Button is disabled"
            : "Element not found";
        return createErrorResponse(errMsg);
      }
    } catch (error) {
      console.error(
        `${logPrefix} Error processing click_button RPC call:`,
        error,
      );
      return createErrorResponse("Element not found");
    }
  },

  fill_input: async (data: { payload?: string | unknown }) => {
    const logPrefix = "[FILL INPUT RPC]";
    console.log(`${logPrefix} 🔵 fill_input RPC handler called!`);
    console.log(`${logPrefix} RPC data received:`, data);

    try {
      const payload = parsePayload(data);
      console.log(`${logPrefix} Parsed payload:`, payload);

      const jsid = payload?.jsid;
      const text = payload?.text ?? payload?.value;

      if (!jsid || typeof jsid !== "string") {
        console.error(
          `${logPrefix} Invalid jsid passed to fill_input:`,
          payload,
        );
        return createErrorResponse("Invalid jsid");
      }

      if (typeof text !== "string") {
        console.error(
          `${logPrefix} Invalid text/value passed to fill_input:`,
          payload,
        );
        return createErrorResponse("Invalid text/value");
      }

      console.log(
        `${logPrefix} ✅ Received fill_input RPC call jsid="${jsid}", text="${text}"`,
      );

      const result = await executeAction(
        "fill_input",
        { jsId: jsid, value: text },
        () => {
          if (typeof SiteAutomation.fill_input !== "function") {
            console.error("SiteAutomation.fill_input method not found");
            return false;
          }
          return SiteAutomation.fill_input(jsid, text);
        },
      );

      if (result.success) {
        console.log(`${logPrefix} Input fill successful jsid="${jsid}"`);
        return createSuccessResponse({ jsid, text });
      } else {
        console.error(`${logPrefix} Failed to fill input jsid="${jsid}"`);
        return createErrorResponse(result.error || "Fill input failed");
      }
    } catch (error) {
      console.error(
        `${logPrefix} Error processing fill_input RPC call:`,
        error,
      );
      return createErrorResponse(
        error instanceof Error ? error.message : String(error),
      );
    }
  },

  set_radio: async (data: { payload?: string | unknown }) => {
    const logPrefix = "[SET RADIO RPC]";
    console.log(`${logPrefix} 🔵 set_radio RPC handler called!`);
    console.log(`${logPrefix} RPC data received:`, data);

    try {
      const payload = parsePayload(data);
      console.log(`${logPrefix} Parsed payload:`, payload);

      const jsid = payload?.jsid;
      const value = payload?.value;

      if (!jsid || typeof jsid !== "string") {
        console.error(`${logPrefix} Invalid jsid provided:`, payload);
        return createErrorResponse("Invalid jsid");
      }

      console.log(
        `${logPrefix} ✅ Received set_radio RPC call jsid="${jsid}", value="${value}"`,
      );

      const result = await executeAction(
        "set_radio",
        { jsId: jsid, checked: true },
        () => {
          if (typeof SiteAutomation.set_radio !== "function") {
            console.error("SiteAutomation.set_radio method not found");
            return false;
          }
          return SiteAutomation.set_radio(jsid, value);
        },
      );

      if (result.success) {
        console.log(
          `${logPrefix} Radio selection successful jsid="${jsid}" value="${value}"`,
        );
        return createSuccessResponse({ jsid, value });
      } else {
        console.error(
          `${logPrefix} Radio selection failed jsid="${jsid}" value="${value}"`,
        );
        return createErrorResponse(
          result.error || "Radio not found or value not matched",
        );
      }
    } catch (error) {
      console.error(`${logPrefix} Error processing set_radio RPC call:`, error);
      return createErrorResponse(
        error instanceof Error ? error.message : String(error),
      );
    }
  },

  set_checkbox: async (data: { payload?: string | unknown }) => {
    const logPrefix = "[SET CHECKBOX RPC]";
    console.log(`${logPrefix} 🔵 set_checkbox RPC handler called!`);
    console.log(`${logPrefix} RPC data received:`, data);

    try {
      const payload = parsePayload(data);
      console.log(`${logPrefix} Parsed payload:`, payload);

      const jsid = payload?.jsid;
      const checked =
        typeof payload?.checked === "boolean" ? payload.checked : undefined;

      if (!jsid || typeof jsid !== "string") {
        console.error(`${logPrefix} Invalid jsid provided:`, payload);
        return createErrorResponse("Invalid jsid");
      }

      console.log(
        `${logPrefix} ✅ Received set_checkbox RPC call jsid="${jsid}", checked="${checked}"`,
      );

      const result = await executeAction(
        "set_checkbox",
        { jsId: jsid, checked: checked !== false },
        () => {
          if (typeof SiteAutomation.set_checkbox !== "function") {
            console.error("SiteAutomation.set_checkbox method not found");
            return false;
          }
          return SiteAutomation.set_checkbox(jsid, checked);
        },
      );

      if (result.success) {
        console.log(
          `${logPrefix} Checkbox action successful jsid="${jsid}", checked="${checked}"`,
        );
        return createSuccessResponse({ jsid, checked });
      } else {
        console.error(
          `${logPrefix} Checkbox action FAILED jsid="${jsid}", checked="${checked}"`,
        );
        return createErrorResponse(
          result.error || "Checkbox not found or action failed",
        );
      }
    } catch (error) {
      console.error(
        `${logPrefix} Error processing set_checkbox RPC call:`,
        error,
      );
      return createErrorResponse(
        error instanceof Error ? error.message : String(error),
      );
    }
  },

  select_option: async (data: { payload?: string | unknown }) => {
    const logPrefix = "[SELECT OPTION RPC]";
    console.log(`${logPrefix} 🔵 select_option RPC handler called!`);
    console.log(`${logPrefix} RPC data received:`, data);

    try {
      const payload = parsePayload(data);
      console.log(`${logPrefix} Parsed payload:`, payload);

      const jsid = payload?.jsid;
      const valueOrText =
        payload?.value ?? payload?.text ?? payload?.valueOrText;

      if (!jsid || typeof jsid !== "string") {
        console.error(`${logPrefix} Invalid jsid provided:`, payload);
        return createErrorResponse("Invalid jsid");
      }

      if (!valueOrText || typeof valueOrText !== "string") {
        console.error(`${logPrefix} Invalid valueOrText provided:`, payload);
        return createErrorResponse("Invalid value/text");
      }

      console.log(
        `${logPrefix} ✅ Received select_option RPC call jsid="${jsid}", valueOrText="${valueOrText}"`,
      );

      const result = await executeAction(
        "select_option",
        { jsId: jsid, optionText: valueOrText, optionValue: valueOrText },
        () => {
          if (typeof SiteAutomation.select_option !== "function") {
            console.error("SiteAutomation.select_option method not found");
            return false;
          }
          return SiteAutomation.select_option(jsid, valueOrText);
        },
      );

      if (result.success) {
        console.log(
          `${logPrefix} Option selection successful jsid="${jsid}", valueOrText="${valueOrText}"`,
        );
        return createSuccessResponse({ jsid, valueOrText });
      } else {
        console.error(
          `${logPrefix} Option selection FAILED jsid="${jsid}", valueOrText="${valueOrText}"`,
        );
        return createErrorResponse(
          result.error || "Option not found or selection failed",
        );
      }
    } catch (error) {
      console.error(
        `${logPrefix} Error processing select_option RPC call:`,
        error,
      );
      return createErrorResponse(
        error instanceof Error ? error.message : String(error),
      );
    }
  },

  fill_booking_form: async (data: { payload?: string | unknown }) => {
    const logPrefix = "[FILL BOOKING FORM RPC]";
    console.log(`${logPrefix} 🔵 fill_booking_form RPC handler called!`);
    console.log(`${logPrefix} RPC data received:`, data);

    try {
      const payload = parsePayload(data);
      console.log(`${logPrefix} Parsed payload:`, payload);

      const departureName = payload?.departureName ?? payload?.departure;
      const arrivalName = payload?.arrivalName ?? payload?.arrival;
      const tripType = payload?.tripType ?? payload?.type;
      const departureDateISO =
        payload?.departureDateISO ?? payload?.departureDate;
      const returnDateISO = payload?.returnDateISO ?? payload?.returnDate;
      const adults =
        typeof payload?.adults === "number" ? payload.adults : undefined;
      const children =
        typeof payload?.children === "number" ? payload.children : undefined;
      const infants =
        typeof payload?.infants === "number" ? payload.infants : undefined;

      const adultsN = adults ?? 0;
      const childrenN = children ?? 0;
      const infantsN = infants ?? 0;

      const hasStations =
        departureName &&
        arrivalName &&
        typeof departureName === "string" &&
        typeof arrivalName === "string";
      const hasDates =
        tripType &&
        departureDateISO &&
        typeof tripType === "string" &&
        typeof departureDateISO === "string";
      const hasPassengers =
        typeof adultsN === "number" &&
        adultsN >= 0 &&
        (adultsN > 0 || childrenN > 0 || infantsN > 0);

      if (!hasStations && !hasDates && !hasPassengers) {
        return createErrorResponse(
          "Provide at least one: (departureName + arrivalName), or (tripType + departureDateISO), or passenger counts (adults/children/infants)",
        );
      }

      const responsePayload: Record<string, unknown> = {
        departureName,
        arrivalName,
        tripType,
        departureDateISO,
        returnDateISO,
        adults,
        children,
        infants,
      };

      const runIframeStep = async (
        action: string,
        stepData: Record<string, unknown>,
      ) => {
        if (typeof window.__executeParentAction !== "function") {
          return {
            success: false,
            error: "Iframe bridge not available",
          } as const;
        }
        return window.__executeParentAction(action, stepData);
      };

      let ok = true;
      let lastError: string | undefined;

      if (isIframeMode()) {
        if (hasStations) {
          const r = await runIframeStep("select_stations", {
            departureName,
            arrivalName,
          });
          if (!r.success) {
            ok = false;
            lastError = r.error ?? "select_stations failed";
          }
          await bookingStepDelay(1200);
        }
        if (ok && hasDates) {
          const r = await runIframeStep("set_trip_type_and_date", {
            tripType,
            departureDateISO,
            returnDateISO,
          });
          if (!r.success) {
            ok = false;
            lastError = r.error ?? "set_trip_type_and_date failed";
          }
          await bookingStepDelay(5500);
        }
        if (ok && hasPassengers) {
          const r = await runIframeStep("set_passengers", {
            adults: Math.max(1, adultsN),
            children: Math.max(0, childrenN),
            infants: Math.max(0, infantsN),
          });
          if (!r.success) {
            ok = false;
            lastError = r.error ?? "set_passengers failed";
          }
        }
      } else {
        if (hasStations) {
          ok = selectStations(departureName, arrivalName);
          if (!ok) lastError = "select_stations failed";
          await bookingStepDelay(1200);
        }
        if (ok && hasDates) {
          ok = setTripTypeAndDateISO(
            tripType,
            departureDateISO,
            returnDateISO,
          );
          if (!ok) lastError = "set_trip_type_and_date failed";
          await bookingStepDelay(5500);
        }
        if (ok && hasPassengers) {
          ok = setPassengers(
            Math.max(1, adultsN),
            Math.max(0, childrenN),
            Math.max(0, infantsN),
          );
          if (!ok) lastError = "set_passengers failed";
        }
      }

      if (ok) {
        console.log(`${logPrefix} Booking form filled successfully (3-step)`);
        return createSuccessResponse(responsePayload);
      }
      return createErrorResponse(lastError ?? "fill_booking_form failed");
    } catch (error) {
      console.error(
        `${logPrefix} Error processing fill_booking_form RPC call:`,
        error,
      );
      return createErrorResponse(
        error instanceof Error ? error.message : String(error),
      );
    }
  },

  select_stations: async (data: { payload?: string | unknown }) => {
    const logPrefix = "[SELECT STATIONS RPC]";
    try {
      const payload = parsePayload(data);
      const departureName = payload?.departureName ?? payload?.departure;
      const arrivalName = payload?.arrivalName ?? payload?.arrival;
      if (
        !departureName ||
        !arrivalName ||
        typeof departureName !== "string" ||
        typeof arrivalName !== "string"
      ) {
        return createErrorResponse("departureName and arrivalName required");
      }
      const result = await executeAction(
        "select_stations",
        { departureName, arrivalName },
        () => selectStations(departureName, arrivalName),
      );
      if (result.success) {
        return createSuccessResponse({ departureName, arrivalName });
      }
      return createErrorResponse(result.error ?? "select_stations failed");
    } catch (error) {
      console.error(`${logPrefix} Error:`, error);
      return createErrorResponse(
        error instanceof Error ? error.message : String(error),
      );
    }
  },

  set_trip_type_and_date: async (data: { payload?: string | unknown }) => {
    const logPrefix = "[SET TRIP TYPE AND DATE RPC]";
    try {
      const payload = parsePayload(data);
      const tripType = payload?.tripType ?? payload?.type;
      const departureDateISO =
        payload?.departureDateISO ?? payload?.departureDate;
      const returnDateISO = payload?.returnDateISO ?? payload?.returnDate;
      if (
        !tripType ||
        !departureDateISO ||
        typeof tripType !== "string" ||
        typeof departureDateISO !== "string"
      ) {
        return createErrorResponse("tripType and departureDateISO required");
      }
      const result = await executeAction(
        "set_trip_type_and_date",
        {
          tripType,
          departureDateISO,
          returnDateISO,
        },
        () =>
          setTripTypeAndDateISO(tripType, departureDateISO, returnDateISO),
      );
      if (result.success) {
        return createSuccessResponse({
          tripType,
          departureDateISO,
          returnDateISO,
        });
      }
      return createErrorResponse(
        result.error ?? "set_trip_type_and_date failed",
      );
    } catch (error) {
      console.error(`${logPrefix} Error:`, error);
      return createErrorResponse(
        error instanceof Error ? error.message : String(error),
      );
    }
  },

  set_passengers: async (data: { payload?: string | unknown }) => {
    const logPrefix = "[SET PASSENGERS RPC]";
    try {
      const payload = parsePayload(data);
      const adults = typeof payload?.adults === "number" ? payload.adults : 0;
      const children =
        typeof payload?.children === "number" ? payload.children : 0;
      const infants =
        typeof payload?.infants === "number" ? payload.infants : 0;
      const result = await executeAction(
        "set_passengers",
        { adults, children, infants },
        () =>
          setPassengers(
            Math.max(1, adults),
            Math.max(0, children),
            Math.max(0, infants),
          ),
      );
      if (result.success) {
        return createSuccessResponse({ adults, children, infants });
      }
      return createErrorResponse(result.error ?? "set_passengers failed");
    } catch (error) {
      console.error(`${logPrefix} Error:`, error);
      return createErrorResponse(
        error instanceof Error ? error.message : String(error),
      );
    }
  },

  open_mat_select: async (data: { payload?: string | unknown }) => {
    const logPrefix = "[OPEN MAT SELECT RPC]";
    console.log(`${logPrefix} 🔵 open_mat_select RPC handler called!`);
    console.log(`${logPrefix} RPC data received:`, data);

    try {
      const payload = parsePayload(data);
      console.log(`${logPrefix} Parsed payload:`, payload);

      const jsid = payload?.jsid || payload;

      if (!jsid || typeof jsid !== "string") {
        console.error(`${logPrefix} Invalid jsid provided:`, payload);
        return createErrorResponse("Invalid jsid");
      }

      console.log(
        `${logPrefix} ✅ Received open_mat_select RPC call jsid="${jsid}"`,
      );

      const result = await executeAction(
        "open_mat_select",
        { jsId: jsid },
        () => {
          if (typeof SiteAutomation.open_mat_select !== "function") {
            console.error("SiteAutomation.open_mat_select method not found");
            return false;
          }
          return SiteAutomation.open_mat_select(jsid);
        },
      );

      if (result.success) {
        console.log(`${logPrefix} mat-select open successful jsid="${jsid}"`);
        return createSuccessResponse({ jsid });
      } else {
        console.error(`${logPrefix} mat-select open FAILED jsid="${jsid}"`);
        return createErrorResponse(
          result.error || "mat-select not found or open failed",
        );
      }
    } catch (error) {
      console.error(
        `${logPrefix} Error processing open_mat_select RPC call:`,
        error,
      );
      return createErrorResponse(
        error instanceof Error ? error.message : String(error),
      );
    }
  },

  select_mat_option: async (data: { payload?: string | unknown }) => {
    const logPrefix = "[SELECT MAT OPTION RPC]";
    console.log(`${logPrefix} 🔵 select_mat_option RPC handler called!`);
    console.log(`${logPrefix} RPC data received:`, data);

    try {
      const payload = parsePayload(data);
      console.log(`${logPrefix} Parsed payload:`, payload);

      const jsid = payload?.jsid || payload;
      const optionText = payload?.text || payload?.optionText;

      if (!jsid || typeof jsid !== "string") {
        console.error(`${logPrefix} Invalid jsid provided:`, payload);
        return createErrorResponse("Invalid jsid");
      }

      console.log(
        `${logPrefix} ✅ Received select_mat_option RPC call jsid="${jsid}"`,
      );

      const result = await executeAction(
        "select_mat_option",
        { jsId: jsid, optionText: optionText || jsid },
        () => {
          if (typeof SiteAutomation.select_mat_option !== "function") {
            console.error("SiteAutomation.select_mat_option method not found");
            return false;
          }
          return SiteAutomation.select_mat_option(jsid);
        },
      );

      if (result.success) {
        console.log(
          `${logPrefix} mat-option selection successful jsid="${jsid}"`,
        );
        return createSuccessResponse({ jsid });
      } else {
        console.error(
          `${logPrefix} mat-option selection FAILED jsid="${jsid}"`,
        );
        return createErrorResponse(
          result.error || "mat-option not found or selection failed",
        );
      }
    } catch (error) {
      console.error(
        `${logPrefix} Error processing select_mat_option RPC call:`,
        error,
      );
      return createErrorResponse(
        error instanceof Error ? error.message : String(error),
      );
    }
  },

  add_to_cart: async (data: { payload?: string | unknown }) => {
    const logPrefix = "[ADD TO CART RPC]";
    console.log(`${logPrefix} 🔵 add_to_cart RPC handler called!`, data);

    try {
      const payload = (parsePayload(data) || {}) as Record<string, unknown>;
      console.log(`${logPrefix} Parsed payload:`, payload);

      const res = await fetch("/api/niceone-rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "add_to_cart", payload }),
      });

      const result = (await res.json()) as Record<string, unknown>;
      console.log(`${logPrefix} API result:`, result);

      if (result.success) {
        // Trigger live cart badge / store refresh in the host shell & iframe without navigating
        executeAction("refresh_store", { type: "cart" }, () => {
          const win = window as unknown as { __niceoneRefreshStore?: () => void };
          win.__niceoneRefreshStore?.();
          return true;
        }).catch(() => {});
      }

      return JSON.stringify(result);
    } catch (error) {
      console.error(`${logPrefix} Error processing add_to_cart RPC:`, error);
      return createErrorResponse(
        error instanceof Error ? error.message : String(error),
      );
    }
  },

  add_to_favourites: async (data: { payload?: string | unknown }) => {
    const logPrefix = "[ADD TO FAVOURITES RPC]";
    console.log(`${logPrefix} 🔵 add_to_favourites RPC handler called!`, data);

    try {
      const payload = (parsePayload(data) || {}) as Record<string, unknown>;
      console.log(`${logPrefix} Parsed payload:`, payload);

      const res = await fetch("/api/niceone-rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "add_to_favourites", payload }),
      });

      const result = (await res.json()) as Record<string, unknown>;
      console.log(`${logPrefix} API result:`, result);

      if (result.success) {
        // Trigger live wishlist badge / heart refresh in the host shell & iframe without navigating
        executeAction("refresh_store", { type: "wishlist" }, () => {
          const win = window as unknown as { __niceoneRefreshStore?: () => void };
          win.__niceoneRefreshStore?.();
          return true;
        }).catch(() => {});
      }

      return JSON.stringify(result);
    } catch (error) {
      console.error(
        `${logPrefix} Error processing add_to_favourites RPC:`,
        error,
      );
      return createErrorResponse(
        error instanceof Error ? error.message : String(error),
      );
    }
  },

  get_cart: async (data: { payload?: string | unknown }) => {
    const logPrefix = "[GET CART RPC]";
    console.log(`${logPrefix} 🔵 get_cart RPC handler called!`, data);

    try {
      const payload = (parsePayload(data) || {}) as Record<string, unknown>;
      const res = await fetch("/api/niceone-rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "get_cart", payload }),
      });

      const result = (await res.json()) as Record<string, unknown>;
      console.log(`${logPrefix} API result:`, result);
      return JSON.stringify(result);
    } catch (error) {
      console.error(`${logPrefix} Error processing get_cart RPC:`, error);
      return createErrorResponse(
        error instanceof Error ? error.message : String(error),
      );
    }
  },

  get_favourites: async (data: { payload?: string | unknown }) => {
    const logPrefix = "[GET FAVOURITES RPC]";
    console.log(`${logPrefix} 🔵 get_favourites RPC handler called!`, data);

    try {
      const payload = (parsePayload(data) || {}) as Record<string, unknown>;
      const res = await fetch("/api/niceone-rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "get_favourites", payload }),
      });

      const result = (await res.json()) as Record<string, unknown>;
      console.log(`${logPrefix} API result:`, result);
      return JSON.stringify(result);
    } catch (error) {
      console.error(`${logPrefix} Error processing get_favourites RPC:`, error);
      return createErrorResponse(
        error instanceof Error ? error.message : String(error),
      );
    }
  },

  checkout: async (data: { payload?: string | unknown }) => {
    const logPrefix = "[CHECKOUT RPC]";
    console.log(`${logPrefix} 🔵 checkout RPC handler called!`);
    console.log(`${logPrefix} RPC data received:`, data);

    try {
      const payload = parsePayload(data);
      console.log(`${logPrefix} Parsed payload:`, payload);

      const country =
        payload?.country ?? payload?.countryCode ?? payload?.country_code;
      const phone_number =
        payload?.phone_number ?? payload?.phoneNumber ?? payload?.phone;
      const email = payload?.email ?? payload?.emailAddress;

      if (!country || typeof country !== "string") {
        console.error(`${logPrefix} Invalid country provided:`, payload);
        return createErrorResponse("Invalid country");
      }

      const countryTrimmed = country.trim();
      const isSA = countryTrimmed.toUpperCase() === "SA";

      let phoneOrEmail: string;
      if (isSA) {
        if (!phone_number || typeof phone_number !== "string") {
          console.error(`${logPrefix} phone_number required for country SA`);
          return createErrorResponse("phone_number required for country SA");
        }
        phoneOrEmail = String(phone_number).trim();
        if (!phoneOrEmail) {
          return createErrorResponse("phone_number is required");
        }
        // SA phone: exactly 9 digits, must start with 5
        if (!/^5\d{8}$/.test(phoneOrEmail)) {
          return createErrorResponse(
            "phone_number must be exactly 9 digits and start with 5 (e.g. 501234567)",
          );
        }
      } else {
        if (!email || typeof email !== "string") {
          console.error(
            `${logPrefix} email required for country other than SA`,
            payload,
          );
          return createErrorResponse(
            "email required for country other than SA",
          );
        }
        phoneOrEmail = String(email).trim();
        if (!phoneOrEmail) {
          return createErrorResponse("email is required");
        }
      }

      console.log(
        `${logPrefix} ✅ Received checkout RPC call country="${countryTrimmed}", ${isSA ? "phone_number" : "email"}="${phoneOrEmail}"`,
      );

      const result = await executeAction(
        "checkout",
        { country: countryTrimmed, phoneOrEmail },
        () => {
          if (typeof SiteAutomation.checkout !== "function") {
            console.error("SiteAutomation.checkout method not found");
            return false;
          }
          return (SiteAutomation.checkout as (
            country: string,
            phoneOrEmail: string,
          ) => boolean)(countryTrimmed, phoneOrEmail);
        },
      );

      if (result.success) {
        console.log(
          `${logPrefix} Checkout successful country="${countryTrimmed}"`,
        );
        return createSuccessResponse({
          country: countryTrimmed,
          ...(isSA ? { phone_number: phoneOrEmail } : { email: phoneOrEmail }),
        });
      } else {
        console.error(
          `${logPrefix} Checkout FAILED country="${countryTrimmed}"`,
        );
        return createErrorResponse(result.error || "Checkout failed");
      }
    } catch (error) {
      console.error(
        `${logPrefix} Error processing checkout RPC call:`,
        error,
      );
      return createErrorResponse(
        error instanceof Error ? error.message : String(error),
      );
    }
  },
};
