/**
 * SiteAutomation - DOM automation utilities
 * Provides methods to interact with page elements via jsid
 */

export interface SiteAutomationInterface {
  add_to_cart?(quantity: string, warranty_index?: number): boolean;
  checkout?(country: string, phoneOrEmail: string): boolean;
  fill_input(jsid: string, text: string): boolean;
  soft_navigate(route: string): boolean;
  hard_navigate(route: string): boolean;
  navigate(route: string): boolean;
  click_button(jsid: string): boolean;
  set_checkbox(jsid: string, checked?: boolean): boolean;
  set_radio(jsid: string, value?: string): boolean; // value parameter is ignored, only jsid is used
  select_option(jsid: string, valueOrText: string): boolean;
  open_mat_select(jsid: string): boolean;
  select_mat_option(jsid: string): boolean;
}

/**
 * Recursively search for an element across shadow DOM boundaries and iframes
 * Matches the approach used in interactiveDomSerializer for consistency
 */
function querySelectorDeep(
  root: Document | ShadowRoot | HTMLElement,
  selector: string,
): HTMLElement | null {
  // Try to find in current root
  const found = root.querySelector<HTMLElement>(selector);
  if (found) return found;

  // Walk through all elements to search shadow DOM and iframes
  const allElements = root.querySelectorAll("*");
  for (const el of Array.from(allElements)) {
    // Search in shadow DOM
    if (el.shadowRoot) {
      const shadowFound = querySelectorDeep(el.shadowRoot, selector);
      if (shadowFound) return shadowFound;
    }

    // Search in iframes (same origin only)
    const tag = el.tagName?.toLowerCase();
    if (tag === "iframe") {
      try {
        const iframe = el as HTMLIFrameElement;
        const iframeDoc =
          iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc && iframeDoc.body) {
          // Search within the iframe's body
          const iframeFound = querySelectorDeep(iframeDoc.body, selector);
          if (iframeFound) return iframeFound;
        }
      } catch {
        // Cross-origin iframe - cannot access contentDocument
        // Silently skip (matching serializer behavior)
      }
    }
  }

  // Also search iframes at document level (for cases where root is document)
  if (root === document || root instanceof Document) {
    const iframes = root.querySelectorAll("iframe");
    for (const iframe of Array.from(iframes)) {
      try {
        const iframeEl = iframe as HTMLIFrameElement;
        const iframeDoc =
          iframeEl.contentDocument || iframeEl.contentWindow?.document;
        if (iframeDoc && iframeDoc.body) {
          const iframeFound = querySelectorDeep(iframeDoc.body, selector);
          if (iframeFound) return iframeFound;
        }
      } catch {
        // Cross-origin iframe - cannot access contentDocument
        // Silently skip (matching serializer behavior)
      }
    }
  }

  return null;
}

const SiteAutomation: SiteAutomationInterface = {
  fill_input(jsid: string, text: string): boolean {
    const selector = `[data-js-id="${jsid}"]`;
    const input = querySelectorDeep(document, selector) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    if (!input) {
      console.warn("Input not found: " + selector);
      return false;
    }

    // Use native setter for all inputs to bypass framework-specific getters/setters
    // This ensures Angular/React state updates correctly
    const proto =
      input instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : HTMLTextAreaElement.prototype;

    const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

    // Focus first (some frameworks need this)
    input.focus();

    if (nativeSetter) {
      // Use native setter to bypass framework overrides
      nativeSetter.call(input, text);

      // Verify value was set correctly
      if (input.value !== text) {
        console.warn(
          "Native setter failed to set value, falling back to standard method",
        );
        // Fall through to standard method below
      } else {
        // Value was set successfully, dispatch events with proper InputEvent
        input.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            composed: true,
            inputType: "insertText",
            data: text,
          }),
        );

        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.blur();
        return true;
      }
    }

    // Fallback to standard method if native setter failed or doesn't exist
    // Set value
    input.value = text;

    // Dispatch events in the correct order for Angular/React compatibility
    // Use InputEvent for better framework compatibility
    input.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        composed: true,
        inputType: "insertText",
        data: text,
      }),
    );

    // Change event (for form validation and submission)
    input.dispatchEvent(
      new Event("change", { bubbles: true, cancelable: true }),
    );

    // Blur event (some frameworks validate on blur)
    input.blur();

    return true;
  },

  soft_navigate(route: string): boolean {
    if (!route || typeof route !== "string") return false;
    const normalized = route.trim().startsWith("/")
      ? route.trim()
      : `/${route.trim()}`;

    window.location.href =
      "https://" + window.location.href.split("/")[2] + normalized;
    return true;
  },

  hard_navigate(route: string): boolean {
    if (!route || typeof route !== "string") return false;
    window.location.href = route.trim();
    return true;
  },

  navigate(route: string): boolean {
    if (!route || typeof route !== "string") return false;
    const trimmed = route.trim();

    // Check for iframe live proxy navigation first
    if (typeof window !== "undefined") {
      const win = window as unknown as {
        __niceoneLiveNavigate?: (u: string) => boolean;
        __alawalyLiveNavigate?: (u: string) => boolean;
      };
      if (typeof win.__niceoneLiveNavigate === "function") {
        const ok = win.__niceoneLiveNavigate(trimmed);
        if (ok) return true;
      } else if (typeof win.__alawalyLiveNavigate === "function") {
        const ok = win.__alawalyLiveNavigate(trimmed);
        if (ok) return true;
      }
    }

    // Full URL (external) requires hard navigation
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return this.hard_navigate(trimmed);
    }

    // Same-origin routes use soft navigation (falls back to hard if needed)
    return this.soft_navigate(trimmed);
  },

  click_button(jsid: string): boolean {
    const selector = `[data-js-id="${jsid}"]`;
    const btn = querySelectorDeep(document, selector) as HTMLElement | null;
    if (!btn) {
      console.warn("Button not found: " + selector);
      return false;
    }

    // Check if button is disabled
    const isDisabled =
      btn.hasAttribute("disabled") ||
      (btn as HTMLButtonElement).disabled ||
      btn.style.pointerEvents === "none" ||
      window.getComputedStyle(btn).pointerEvents === "none";

    if (isDisabled) {
      console.warn(`Button ${jsid} is disabled and cannot be clicked`);
      return false;
    }

    btn.click();

    return true;
  },

  set_checkbox(jsid: string, checked?: boolean): boolean {
    const selector = `[data-js-id="${jsid}"]`;
    const checkbox = querySelectorDeep(
      document,
      selector,
    ) as HTMLInputElement | null;
    if (!checkbox || checkbox.type !== "checkbox") {
      console.warn("Checkbox not found: " + selector);
      return false;
    }
    checkbox.click();

    // Focus first
    checkbox.focus();

    // Set checked state
    if (typeof checked === "boolean") {
      checkbox.checked = checked;
    } else {
      checkbox.checked = !checkbox.checked; // Toggle
    }

    // Dispatch events for Angular/React compatibility
    // 1. Click event (some frameworks listen to click for checkboxes)
    checkbox.click();
    checkbox.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    // 2. Change event (standard form event)
    checkbox.dispatchEvent(
      new Event("change", { bubbles: true, cancelable: true }),
    );

    // 3. Input event (React sometimes needs this)
    checkbox.dispatchEvent(
      new Event("input", { bubbles: true, cancelable: true }),
    );

    return true;
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  set_radio(jsid: string, _value?: string): boolean {
    // Ignore value parameter, only use jsid to find the element directly
    const selector = `[data-js-id="${jsid}"]`;
    const radio = querySelectorDeep(
      document,
      selector,
    ) as HTMLInputElement | null;
    if (!radio || radio.type !== "radio") {
      console.warn("Radio not found: " + selector);
      return false;
    }
    radio.click();

    // Focus first
    radio.focus();

    // Set checked state directly using jsid
    radio.checked = true;

    // Dispatch events for Angular/React compatibility
    // 1. Click event (some frameworks listen to click for radios)
    radio.click();
    radio.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    // 2. Change event (standard form event)
    radio.dispatchEvent(
      new Event("change", { bubbles: true, cancelable: true }),
    );

    // 3. Input event (React sometimes needs this)
    radio.dispatchEvent(
      new Event("input", { bubbles: true, cancelable: true }),
    );

    return true;
  },

  select_option(jsid: string, valueOrText: string): boolean {
    const selector = `[data-js-id="${jsid}"]`;
    const select = querySelectorDeep(
      document,
      selector,
    ) as HTMLSelectElement | null;
    if (!select || select.tagName !== "SELECT") {
      console.warn("Select element not found: " + selector);
      return false;
    }

    // Try to find option by value first
    let option = Array.from(select.options).find(
      (opt) => opt.value === valueOrText,
    );

    // If not found by value, try to find by text content
    if (!option) {
      option = Array.from(select.options).find(
        (opt) => opt.text.trim() === valueOrText.trim(),
      );
    }

    if (!option) {
      console.warn(`Option "${valueOrText}" not found in select: ${selector}`);
      return false;
    }

    // Focus first
    select.focus();

    // Set the selected option
    select.value = option.value;

    // Dispatch events for Angular/React compatibility
    // 1. Input event (for real-time updates)
    select.dispatchEvent(
      new Event("input", { bubbles: true, cancelable: true }),
    );

    // 2. Change event (standard form event - most important)
    select.dispatchEvent(
      new Event("change", { bubbles: true, cancelable: true }),
    );

    // 3. For Angular: dispatch native change event with proper properties
    const nativeChangeEvent = new Event("change", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(nativeChangeEvent, "target", {
      value: select,
      enumerable: true,
    });
    select.dispatchEvent(nativeChangeEvent);

    return true;
  },

  open_mat_select(jsid: string): boolean {
    const selector = `[data-js-id="${jsid}"]`;
    const matSelect = querySelectorDeep(document, selector);
    if (!matSelect) {
      console.error(`Select element with data-js-id="${jsid}" not found`);
      return false;
    }
    const trigger = matSelect.querySelector<HTMLElement>(
      ".mat-mdc-select-trigger",
    );
    if (!trigger) {
      console.error(`mat-select trigger not found for data-js-id="${jsid}"`);
      return false;
    }
    trigger.click();
    return true;
  },

  select_mat_option(jsid: string): boolean {
    const selector = `[data-js-id="${jsid}"]`;
    const option = querySelectorDeep(document, selector);
    if (!option) {
      console.error(`Option element with data-js-id="${jsid}" not found`);
      return false;
    }
    option.click();
    return true;
  },
};

// Set on window for global access (backward compatibility)
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).SiteAutomation = SiteAutomation;
}

// ES module default export
export default SiteAutomation;
