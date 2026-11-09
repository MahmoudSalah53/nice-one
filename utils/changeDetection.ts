interface RelevantData {
  jsid: string;
  tag: string;
  type: string | null;
  value: string | null;
  checked: boolean | null;
  selectedOption?: string | null;
}

type ChangeDetectionCallback = (data: {
  jsid: string;
  tag: string;
  type?: string | null;
  eventType: "click" | "change";
  value?: string | null;
  checked?: boolean | null;
  selectedOption?: string | null;
}) => void;

const getRelevantData = (target: EventTarget): RelevantData => {
  const element = target as HTMLElement;
  const tag = element.tagName.toLowerCase();

  const jsid =
    Array.from(element.attributes || []).find(
      (attribute) => attribute.name === "data-js-id",
    )?.value || "no data-js-id";

  const htmlInputElement = element as HTMLInputElement;
  const htmlSelectElement = element as HTMLSelectElement;

  // Get input type (for input elements)
  let inputType: string | null = null;
  if (tag === "input") {
    inputType = htmlInputElement.type || "text";
  }

  // Handle select elements
  let selectedOption: string | null = null;
  if (tag === "select" && htmlSelectElement.selectedOptions.length > 0) {
    const selected = htmlSelectElement.selectedOptions[0];
    selectedOption = selected.text.trim();
  }

  return {
    jsid,
    tag,
    type: inputType,
    value: htmlInputElement.value || null,
    checked: htmlInputElement.checked ?? null,
    selectedOption: selectedOption || null,
  };
};

const hasDataJsId = (target: EventTarget | null): boolean => {
  if (!target) return false;
  const element = target as HTMLElement;
  return element.hasAttribute("data-js-id");
};

/**
 * Extract selectedOption text from a mat-select element
 */
const getMatSelectSelectedOption = (matSelect: HTMLElement): string | null => {
  if (!matSelect) return null;

  // Try to get the displayed text from the mat-select
  // Mat-select typically shows the selected value in its textContent or in a child element
  const text = matSelect.textContent?.trim() || matSelect.innerText?.trim();
  if (text) return text;

  // Try to find the selected option text in common Angular Material structures
  // Look for mat-select-trigger or mat-select-value-text
  const trigger = matSelect.querySelector(
    '.mat-select-trigger, .mat-select-value-text, [class*="mat-select-value"]',
  );
  if (trigger) {
    const triggerElement = trigger as HTMLElement;
    const triggerText =
      triggerElement.textContent?.trim() || triggerElement.innerText?.trim();
    if (triggerText) return triggerText;
  }

  return null;
};

/**
 * Find the mat-select element associated with a mat-option
 * Angular Material renders mat-option in an overlay, so we need special handling
 */
const findNearestMatSelect = (matOption: HTMLElement): HTMLElement | null => {
  if (!matOption) return null;

  // First, try to find parent mat-select using closest (in case it's not in overlay)
  const parentMatSelect = matOption.closest("mat-select[data-js-id]");
  if (parentMatSelect) {
    return parentMatSelect as HTMLElement;
  }

  // Angular Material renders mat-option in an overlay panel
  // Find the overlay panel that contains this mat-option
  const overlayPanel = matOption.closest(
    ".cdk-overlay-pane, .mat-select-panel, [class*='mat-select-panel'], [class*='cdk-overlay']",
  );

  if (overlayPanel) {
    // Try to find mat-select by aria-owns or similar attributes on the overlay
    const ariaOwns = overlayPanel.getAttribute("aria-owns");
    if (ariaOwns) {
      const matSelect = document.querySelector(
        `mat-select#${ariaOwns}[data-js-id]`,
      ) as HTMLElement;
      if (matSelect) return matSelect;
    }

    // Try to find by data attributes or id references
    const panelId = overlayPanel.id;
    if (panelId) {
      const matSelect = document.querySelector(
        `mat-select[aria-owns="${panelId}"][data-js-id], mat-select[aria-controls="${panelId}"][data-js-id]`,
      ) as HTMLElement;
      if (matSelect) return matSelect;
    }
  }

  // Fallback: Find all mat-selects and check which one is currently open
  // An open mat-select typically has aria-expanded="true"
  // Since mat-option is in an overlay, find the open mat-select
  const allMatSelects = document.querySelectorAll(
    "mat-select[data-js-id]",
  ) as NodeListOf<HTMLElement>;

  // If we found an overlay panel, try to match it to an open mat-select
  if (overlayPanel) {
    for (const matSelect of Array.from(allMatSelects)) {
      // Check if this mat-select is currently open
      const isOpen = matSelect.getAttribute("aria-expanded") === "true";

      if (isOpen) {
        // Verify the overlay panel contains our mat-option
        if (overlayPanel.contains(matOption)) {
          // Additional check: verify panel is positioned near the select
          const selectRect = matSelect.getBoundingClientRect();
          const panelRect = overlayPanel.getBoundingClientRect();
          // Check if panel is positioned near the select (typical Angular Material behavior)
          // Panel is usually directly below or near the select
          if (
            Math.abs(panelRect.top - selectRect.bottom) < 100 ||
            Math.abs(panelRect.left - selectRect.left) < 200
          ) {
            return matSelect;
          }
        }
      }
    }

    // If no match found by position, but we have an overlay panel,
    // just return the first open mat-select (usually only one is open at a time)
    for (const matSelect of Array.from(allMatSelects)) {
      if (matSelect.getAttribute("aria-expanded") === "true") {
        console.log(
          "[CHANGE DETECTION] Using fallback: found open mat-select by aria-expanded",
        );
        return matSelect;
      }
    }
  }

  // Last resort: Search up the DOM tree for nearest mat-select
  let current: HTMLElement | null = matOption.parentElement;
  let level = 0;
  const maxLevels = 20; // Increased since overlay might be deeper

  while (current && level < maxLevels) {
    const tag = current.tagName?.toLowerCase();
    if (tag === "mat-select" && current.hasAttribute("data-js-id")) {
      return current;
    }
    current = current.parentElement;
    level++;
  }

  return null;
};

let changeDetectionCallback: ChangeDetectionCallback | null = null;

export const setChangeDetectionCallback = (
  callback: ChangeDetectionCallback | null,
): void => {
  changeDetectionCallback = callback;
  if (callback) {
    console.log("[CHANGE DETECTION] Callback registered successfully");
  } else {
    console.log("[CHANGE DETECTION] Callback cleared");
  }
};

const handleClickEvent = (e: MouseEvent): void => {
  const target = e.target;
  if (!target) {
    console.log(`no target for this event ${e}`);
    return;
  }

  const targetElement = target as HTMLElement;
  if (targetElement.closest(".booking-card")) return;

  // Check if mat-option was clicked (or click is inside mat-option)
  const matOption = targetElement.closest("mat-option");
  if (matOption) {
    console.log(
      "[CHANGE DETECTION] mat-option clicked, finding parent mat-select",
    );
    console.log("[CHANGE DETECTION] mat-option element:", matOption);

    // Get the option text that will be selected
    const matOptionElement = matOption as HTMLElement;
    const optionText =
      matOptionElement.textContent?.trim() ||
      matOptionElement.innerText?.trim();
    console.log("[CHANGE DETECTION] mat-option text:", optionText);

    // Try to find mat-select immediately (before overlay closes)
    let matSelect = findNearestMatSelect(matOption as HTMLElement);

    // Use setTimeout to wait for Angular Material to update the mat-select's selectedOption
    // This ensures we get the updated value after the click
    setTimeout(() => {
      // If we didn't find it before, try again after DOM updates
      if (!matSelect) {
        console.log(
          "[CHANGE DETECTION] Retrying to find mat-select after DOM update",
        );
        matSelect = findNearestMatSelect(matOption as HTMLElement);
      }

      // If still not found, try finding by matching the selectedOption text
      if (!matSelect && optionText) {
        console.log(
          "[CHANGE DETECTION] Trying to find mat-select by matching selectedOption text",
        );
        const allMatSelects = document.querySelectorAll(
          "mat-select[data-js-id]",
        ) as NodeListOf<HTMLElement>;

        for (const select of Array.from(allMatSelects)) {
          const selectedOption = getMatSelectSelectedOption(select);
          if (selectedOption === optionText) {
            console.log(
              "[CHANGE DETECTION] Found mat-select by matching selectedOption",
            );
            matSelect = select;
            break;
          }
        }
      }

      if (!matSelect) {
        console.warn(
          "[CHANGE DETECTION] mat-option clicked but no mat-select found after retry",
        );
        console.log(
          "[CHANGE DETECTION] Debug: Searching for all mat-selects in document",
        );
        const allMatSelects = document.querySelectorAll(
          "mat-select[data-js-id]",
        );
        console.log(
          `[CHANGE DETECTION] Found ${allMatSelects.length} mat-select(s) with data-js-id`,
        );
        Array.from(allMatSelects).forEach((select, idx) => {
          const jsid = select.getAttribute("data-js-id");
          const selectedOpt = getMatSelectSelectedOption(select as HTMLElement);
          console.log(
            `[CHANGE DETECTION] mat-select ${idx + 1}: jsid="${jsid}", selectedOption="${selectedOpt}"`,
          );
        });
        return;
      }

      // Get the jsid from mat-select
      const jsid =
        Array.from(matSelect.attributes || []).find(
          (attribute) => attribute.name === "data-js-id",
        )?.value || "no data-js-id";

      // Extract selectedOption from mat-select
      const selectedOption = getMatSelectSelectedOption(matSelect);

      console.log("[CHANGE DETECTION] mat-select found:", {
        jsid,
        selectedOption,
      });

      // Call the callback with mat-select data instead of mat-option
      if (changeDetectionCallback) {
        console.log(
          "[CHANGE DETECTION] Calling callback with mat-select data:",
          {
            jsid,
            tag: "mat-select",
            eventType: "click",
            selectedOption,
          },
        );
        changeDetectionCallback({
          jsid,
          tag: "mat-select",
          eventType: "click",
          selectedOption: selectedOption || null,
        });
      } else {
        console.warn(
          "[CHANGE DETECTION] Callback not set! RPC will not be sent.",
        );
      }
    }, 100); // Increased delay to allow Angular Material to update the DOM and close overlay

    return; // Don't process as regular button/link click
  }

  // Find the closest button or link element that has data-js-id
  // This handles cases where the click is on a nested element (like a div inside a button)
  let interactiveElement: HTMLElement | null = null;

  // First, check if the target itself is a button/link with data-js-id
  const targetTag = targetElement.tagName.toLowerCase();
  if (["button", "a"].includes(targetTag) && hasDataJsId(target)) {
    interactiveElement = targetElement;
  } else {
    // If not, find the closest button or link ancestor with data-js-id
    interactiveElement =
      targetElement.closest("button[data-js-id]") ||
      targetElement.closest("a[data-js-id]");
  }

  if (!interactiveElement) {
    return;
  }

  const data = getRelevantData(interactiveElement);

  console.log(`
    event: ${e.type},
  `);

  Object.keys(data).forEach((k) => {
    const key = k as keyof RelevantData;
    const value = data[key];
    if (value === null || value === undefined) return;
    console.log(`${k}: ${value}`);
  });

  // Call the callback if set
  if (changeDetectionCallback) {
    console.log("[CHANGE DETECTION] Calling callback with data:", {
      jsid: data.jsid,
      tag: data.tag,
      eventType: "click",
    });
    changeDetectionCallback({
      jsid: data.jsid,
      tag: data.tag,
      type: data.type,
      eventType: "click",
      value: data.value,
      checked: data.checked,
      selectedOption: data.selectedOption,
    });
  } else {
    console.warn("[CHANGE DETECTION] Callback not set! RPC will not be sent.");
  }
};

const handleChangeEvent = (e: Event): void => {
  const target = e.target;
  if (!target) {
    console.log(`no target for this event ${e}`);
    return;
  }

  if (!hasDataJsId(target)) {
    return;
  }

  const tag = (target as HTMLElement).tagName.toLowerCase();
  if (tag && tag === "div") {
    console.log(`div was the target of event ${e}`);
    return;
  }

  const data = getRelevantData(target);

  console.log(`
    event: ${e.type},
  `);

  Object.keys(data).forEach((k) => {
    const key = k as keyof RelevantData;
    const value = data[key];
    if (value === null || value === undefined) return;
    console.log(`${k}: ${value}`);
  });

  // Call the callback if set
  if (changeDetectionCallback) {
    console.log("[CHANGE DETECTION] Calling callback with data:", {
      jsid: data.jsid,
      tag: data.tag,
      eventType: "change",
    });
    changeDetectionCallback({
      jsid: data.jsid,
      tag: data.tag,
      type: data.type,
      eventType: "change",
      value: data.value,
      checked: data.checked,
      selectedOption: data.selectedOption,
    });
  } else {
    console.warn("[CHANGE DETECTION] Callback not set! RPC will not be sent.");
  }
};

// Track initialization state globally to prevent duplicate listeners across module instances
const INIT_FLAG = "__changeDetectionInitialized__";

// Initialize event listeners
export const initializeChangeDetection = (): void => {
  // Check if already initialized (handles multiple module instances)
  if (
    typeof window !== "undefined" &&
    (window as unknown as Record<string, boolean>)[INIT_FLAG]
  ) {
    console.log(
      "[CHANGE DETECTION] Already initialized, skipping duplicate setup",
    );
    return;
  }

  // Remove existing listeners if any (to avoid duplicates)
  document.removeEventListener("change", handleChangeEvent, true);
  document.removeEventListener("click", handleClickEvent, true);

  // Listen on document for better event capture (events bubble up)
  document.addEventListener("change", handleChangeEvent, true); // Use capture phase
  document.addEventListener("click", handleClickEvent, true); // Use capture phase

  // Mark as initialized
  if (typeof window !== "undefined") {
    (window as unknown as Record<string, boolean>)[INIT_FLAG] = true;
  }

  console.log(
    "[CHANGE DETECTION] Event listeners registered for 'change' and 'click' events on document (capture phase)",
  );
  console.log("[CHANGE DETECTION] Module loaded and initialized");
};

// Auto-initialize when module loads (only if in browser context)
if (typeof document !== "undefined") {
  initializeChangeDetection();
}
