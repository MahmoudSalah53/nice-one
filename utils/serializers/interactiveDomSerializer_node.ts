/**
 * DOM → JSON for AI (interactive elements with minimal context)
 *
 * Output shape:
 * {
 *   ts:   ISO timestamp,
 *   url:  location.href,
 *   title: document.title,
 *   nIntr: total interactive elements (all elements flattened),
 *   interactiveElements: [ ...all interactive elements flattened (including those from forms)... ]
 * }
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface SerializerConfig {
  interactiveElements: string[];
  excludedContainers: string[];
  includeVal: boolean;
  includeOptions: boolean;
  textLimit: number;
  omitNull: boolean;
}

export interface InteractiveElementNode {
  jsId: string;
  tag?: string;
  role?: string;
  job?: string;
  type?: string;
  value?: string | null;
  selectedOption?: string | null;
  textContent?: string | null;
  selectedElement?: string | null;
  options?: string[] | null;
  checked?: boolean;
  placeholder?: string | null;
  href?: string | null;
  ariaLabel?: string | null;
  nearestP?: string | null;
  nearestSpan?: string | null;
  nearestLabel?: string | null;
  nearestDiv?: string | null;
  nearestH?: string | null;
  children?: InteractiveElementNode[];
}

export interface DOMElementsJSON {
  ts: string;
  url: string | null;
  title: string | null;
  nIntr: number;
  interactiveElements: InteractiveElementNode[];
}

export interface SerializerOptions {
  resetCounter?: boolean;
}

export interface InteractiveDomSerializerInterface {
  config: SerializerConfig;
  setConfig(overrides?: Partial<SerializerConfig>): void;
  resetConfig(): void;
  resetCounters(): void;
  isWritableElement(el: HTMLElement | null): boolean;
  isClickableElement(el: HTMLElement | null): boolean;
  isInteractiveElement(el: HTMLElement | null): boolean;
  getInteractiveElementsAsJson(
    root?: HTMLElement | null,
    options?: SerializerOptions,
  ): DOMElementsJSON;
  getFlatInteractiveElements(
    root?: HTMLElement | null,
    options?: SerializerOptions,
  ): InteractiveElementNode[];
  printInteractiveElementsJson(root?: HTMLElement | null): DOMElementsJSON;
}

const DEFAULT_CONFIG: SerializerConfig = {
  interactiveElements: [
    "button",
    "a",
    "input",
    "textarea",
    "select",
    "mat-select",
    "mat-option",
    // "h1",
    // "h2",
    // "h3",
    // "h4",
    // "h5",
    // "h6",
  ],
  excludedContainers: ["nav", "header", "footer"],
  includeVal: true,
  includeOptions: true,
  textLimit: 200,
  omitNull: true,
};

// ============================================================================
// MAIN CLASS
// ============================================================================

class InteractiveDomSerializer implements InteractiveDomSerializerInterface {
  public config: SerializerConfig;
  private elementIdCounter: number = 0;
  private _idMap = new WeakMap<HTMLElement, string>();
  private _reverseIdMap = new Map<string, HTMLElement>();

  constructor(config?: Partial<SerializerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.normalizeConfig();
  }

  // --------------------------------------------------------------------------
  // CONFIGURATION MANAGEMENT
  // --------------------------------------------------------------------------

  private normalizeConfig(): void {
    const norm = (arr: string[] | unknown): string[] =>
      Array.isArray(arr)
        ? arr.map((t) => String(t).toLowerCase())
        : (arr as string[]);

    this.config.interactiveElements = norm(this.config.interactiveElements);
    // Don't normalize excludedContainers - they are CSS selectors and case-sensitive
    // Simple tag names like "nav", "header", "footer" will still work with closest()
    // because closest() is case-insensitive for tag names, but class names are case-sensitive
    this.config.excludedContainers = Array.isArray(
      this.config.excludedContainers,
    )
      ? this.config.excludedContainers.map((t) => String(t))
      : (this.config.excludedContainers as string[]);
  }

  setConfig(overrides: Partial<SerializerConfig> = {}): void {
    if (!overrides || typeof overrides !== "object") return;
    this.config = { ...this.config, ...overrides };
    this.normalizeConfig();
  }

  resetConfig(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.normalizeConfig();
  }

  resetCounters(): void {
    this.elementIdCounter = 0;
    this._idMap = new WeakMap<HTMLElement, string>();
    this._reverseIdMap = new Map<string, HTMLElement>();

    if (typeof document !== "undefined" && document.body) {
      const allElementsWithJsId = this._getAllElementsWithJsId(document.body);
      for (let i = 0; i < allElementsWithJsId.length; i++) {
        allElementsWithJsId[i].removeAttribute("data-js-id");
      }
    }
  }

  // --------------------------------------------------------------------------
  // ELEMENT CLASSIFICATION
  // --------------------------------------------------------------------------

  isWritableElement(el: HTMLElement | null): boolean {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName.toLowerCase();
    const writableTags = ["input", "textarea", "select"];
    return (
      this.config.interactiveElements.includes(tag) &&
      writableTags.includes(tag)
    );
  }

  isClickableElement(el: HTMLElement | null): boolean {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName.toLowerCase();
    const clickableTags = ["button", "a"];
    return (
      this.config.interactiveElements.includes(tag) &&
      clickableTags.includes(tag)
    );
  }

  isInteractiveElement(el: HTMLElement | null): boolean {
    if (!el || el.nodeType !== 1) return false;
    if (this._isHiddenElement(el)) return false;

    const tag = el.tagName.toLowerCase();

    // Check config array
    if (this.config.interactiveElements.includes(tag)) return true;

    // Check custom dropdown classes
    if (this._hasDropdownClass(el)) return true;

    // Check contentEditable
    if (el.isContentEditable || el.getAttribute("contenteditable")) return true;

    // Check role or aria-label
    const role = el.getAttribute("role");
    const ariaLabel = el.getAttribute("aria-label");
    if (
      role === "button" ||
      (ariaLabel && ariaLabel.trim().toLowerCase() === "button")
    ) {
      return true;
    }

    return false;
  }

  // --------------------------------------------------------------------------
  // ELEMENT VALIDATION & FILTERING
  // --------------------------------------------------------------------------

  private _hasDropdownClass(el: HTMLElement): boolean {
    if (!el || el.nodeType !== 1) return false;
    const classList = el.classList;
    return (
      classList.contains("Dropdown1_input__wYlVv") ||
      classList.contains("Dropdown1_dropdowmItem__4TSnB")
    );
  }

  private _isHiddenElement(el: HTMLElement): boolean {
    if (!el || el.nodeType !== 1) return false;

    const tag = el.tagName.toLowerCase();

    // Check for type="hidden" on input elements
    if (tag === "input") {
      const inputType = (el as HTMLInputElement).type?.toLowerCase();
      if (inputType === "hidden") return true;
      // Exception: Include radio and checkbox inputs even if hidden by CSS/aria-hidden
      if (inputType === "radio" || inputType === "checkbox") return false;
    }

    // Check aria-hidden
    if (el.getAttribute("aria-hidden") === "true") return true;

    // Check computed styles
    if (typeof window !== "undefined" && window.getComputedStyle) {
      const styles = window.getComputedStyle(el);
      if (styles.visibility === "hidden" || styles.display === "none") {
        return true;
      }
    }

    return false;
  }

  private _isInsideExcludedContainer(el: HTMLElement): boolean {
    const { excludedContainers } = this.config;

    // Exception: aria-controls nav elements
    const ariaControls = el.getAttribute("aria-controls");
    if (ariaControls === "nav-wallet-applepay" || ariaControls === "nav-card") {
      return false;
    }

    // Exception: routerlink elements
    const tag = el.tagName.toLowerCase();
    if (tag === "a") {
      const routerLink =
        el.getAttribute("routerlink") || el.getAttribute("routerLink");
      if (routerLink === "submit-incident" || routerLink === "incidents-list") {
        return false;
      }

      // Exception: javascript:WebForm links
      const href = (el as HTMLAnchorElement).getAttribute("href");
      if (href && href.startsWith("javascript:WebForm")) {
        return false;
      }
    }

    // Check excluded containers
    if (
      typeof el.closest === "function" &&
      excludedContainers.some((tag) => el.closest(tag))
    ) {
      return true;
    }

    return false;
  }

  private _shouldIncludeElement(el: HTMLElement): boolean {
    const tag = el.tagName.toLowerCase();

    // Filter anchor tags
    if (tag === "a") {
      const href = (el as HTMLAnchorElement).getAttribute("href");
      const ariaControls = el.getAttribute("aria-controls");

      // Exception: show-more-btn class
      if (el.classList.contains("show-more-btn")) {
        return false;
      }

      // Exception: nav elements
      if (
        ariaControls === "nav-wallet-applepay" ||
        ariaControls === "nav-card"
      ) {
        return true;
      }

      // Allow interactive anchors (tabs)
      const isInteractiveAnchor = el.getAttribute("role") === "tab";
      if (!href || href.trim() === "" || href.trim() === "#") {
        if (isInteractiveAnchor) {
          const textContent = this._getText(el);
          if (textContent && textContent.trim() !== "") return true;
        }
        return false;
      }

      // Require text content
      const textContent = this._getText(el);
      if (!textContent || textContent.trim() === "") return false;
    }

    // Filter buttons without text
    if (tag === "button") {
      const textContent = this._getText(el);
      if (!textContent || textContent.trim() === "") return false;
    }

    return true;
  }

  // --------------------------------------------------------------------------
  // ID MANAGEMENT
  // --------------------------------------------------------------------------

  private _getAllElementsWithJsId(root: HTMLElement): HTMLElement[] {
    const elements: HTMLElement[] = [];

    const collectFromElement = (el: Element | Document | ShadowRoot): void => {
      try {
        const elementsWithJsId = el.querySelectorAll("[data-js-id]");
        for (let i = 0; i < elementsWithJsId.length; i++) {
          elements.push(elementsWithJsId[i] as HTMLElement);
        }

        // Traverse shadow DOM
        const allElements = el.querySelectorAll("*");
        for (let i = 0; i < allElements.length; i++) {
          const elem = allElements[i] as HTMLElement;
          if (elem.shadowRoot) {
            collectFromElement(elem.shadowRoot);
          }
        }

        // Traverse iframes
        if (el instanceof Document || el instanceof HTMLElement) {
          const iframes = el.querySelectorAll("iframe");
          for (let i = 0; i < iframes.length; i++) {
            const iframe = iframes[i] as HTMLIFrameElement;
            try {
              const iframeDoc =
                iframe.contentDocument || iframe.contentWindow?.document;
              if (iframeDoc) {
                collectFromElement(iframeDoc);
              }
            } catch {
              // Cross-origin iframe
            }
          }
        }
      } catch {
        // Ignore errors
      }
    };

    if (typeof document !== "undefined" && root.ownerDocument) {
      collectFromElement(root.ownerDocument);
    }

    return elements;
  }

  private _getCurrentMaxJsId(): number {
    let maxId = 0;

    // Check reverse map
    for (const id of this._reverseIdMap.keys()) {
      const numericPart = id.startsWith("js-") ? id.substring(3) : id;
      const numId = parseInt(numericPart, 10);
      if (!isNaN(numId) && numId > maxId) {
        maxId = numId;
      }
    }

    // Check DOM
    if (typeof document !== "undefined" && document.body) {
      const elementsWithJsId = this._getAllElementsWithJsId(document.body);
      for (let i = 0; i < elementsWithJsId.length; i++) {
        const el = elementsWithJsId[i];
        const id = el.getAttribute("data-js-id");
        if (id) {
          const numericPart = id.startsWith("js-") ? id.substring(3) : id;
          const numId = parseInt(numericPart, 10);
          if (!isNaN(numId) && numId > maxId) {
            maxId = numId;
          }
        }
      }
    }

    return maxId;
  }

  private _ensureJsId(el: HTMLElement): string {
    if (!el || el.nodeType !== 1) return "";

    // Check existing ID in map
    const id = this._idMap.get(el);
    if (id) {
      const existingAttr = el.getAttribute("data-js-id");
      if (existingAttr === id) {
        const mappedElement = this._reverseIdMap.get(id);
        if (mappedElement === el) return id;
        this._reverseIdMap.delete(id);
      }
    }

    // Check existing attribute
    const existingAttr = el.getAttribute("data-js-id");
    if (existingAttr) {
      const mappedElement = this._reverseIdMap.get(existingAttr);
      if (mappedElement === el) {
        this._idMap.set(el, existingAttr);
        return existingAttr;
      } else if (mappedElement && mappedElement !== el) {
        el.removeAttribute("data-js-id");
      } else {
        if (typeof document !== "undefined") {
          const elementsWithId = document.querySelectorAll(
            `[data-js-id="${existingAttr}"]`,
          );
          if (elementsWithId.length === 1 && elementsWithId[0] === el) {
            this._idMap.set(el, existingAttr);
            this._reverseIdMap.set(existingAttr, el);
            return existingAttr;
          }
          el.removeAttribute("data-js-id");
        }
      }
    }

    // Generate new ID
    const currentMaxInDom = this._getCurrentMaxJsId();
    let nextId = currentMaxInDom;
    let newId: string;
    let attempts = 0;
    const maxAttempts = 1000;

    do {
      nextId += 1;
      newId = `js-${nextId}`;
      attempts++;

      if (this._reverseIdMap.has(newId)) continue;

      if (typeof document !== "undefined") {
        const existingElements = document.querySelectorAll(
          `[data-js-id="${newId}"]`,
        );
        if (existingElements.length > 0) continue;
      }

      break;
    } while (attempts < maxAttempts);

    this.elementIdCounter = nextId;
    this._idMap.set(el, newId);
    this._reverseIdMap.set(newId, el);
    if (el.getAttribute("data-js-id") !== newId) {
      el.setAttribute("data-js-id", newId);
    }

    return newId;
  }

  private _cleanupStaleReferences(): void {
    const idsToRemove: string[] = [];

    this._reverseIdMap.forEach((element, id) => {
      if (!document.contains(element)) {
        idsToRemove.push(id);
        this._idMap.delete(element);
      }
    });

    idsToRemove.forEach((id) => this._reverseIdMap.delete(id));
  }

  // --------------------------------------------------------------------------
  // TEXT EXTRACTION
  // --------------------------------------------------------------------------

  private _getText(el: HTMLElement): string | null {
    if (!el || el.nodeType !== 1) return null;
    const max = this.config.textLimit;

    const collectText = (node: Node): string => {
      const parts: string[] = [];
      for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes[i];
        if (child.nodeType === 3) {
          const text = child.textContent?.trim();
          if (text) parts.push(text);
        } else if (child.nodeType === 1) {
          const element = child as HTMLElement;
          const tagName = element.tagName?.toLowerCase();
          if (tagName !== "script" && tagName !== "noscript") {
            const childText = collectText(child);
            if (childText) parts.push(childText);
          }
        }
      }
      return parts.join(" ");
    };

    let txt = collectText(el);
    if (!txt) {
      const clone = el.cloneNode(true) as HTMLElement;
      const scripts = clone.querySelectorAll("script, noscript");
      scripts.forEach((script) => script.remove());
      txt = clone.textContent || "";
    }
    txt = txt.trim();
    if (!txt) return null;

    txt = txt.replace(/\s+/g, " ").trim();
    return txt.length > max ? txt.slice(0, max) + "..." : txt;
  }

  private _getAriaLabel(el: HTMLElement): string | null {
    if (!el || el.nodeType !== 1) return null;
    const ariaLabel = el.getAttribute("aria-label");
    return ariaLabel && ariaLabel.trim() ? ariaLabel.trim() : null;
  }

  // --------------------------------------------------------------------------
  // CONTEXT FINDING (Nearest elements)
  // --------------------------------------------------------------------------

  private _findNearestElementByTagAndClasses(
    el: HTMLElement,
    targetTags: string[],
    targetClasses?: string[],
    maxAncestorLevels: number = 5,
    maxSiblingDepth: number = 2,
  ): string | null {
    if (!el || el.nodeType !== 1) return null;

    const elementMatches = (elem: Element): boolean => {
      const tag = elem.tagName ? elem.tagName.toLowerCase() : "";
      const tagMatches = targetTags.includes(tag);

      // If no classes specified, only check tag
      if (!targetClasses || targetClasses.length === 0) {
        return tagMatches;
      }

      // If classes specified, check both tag and classes
      if (!tagMatches) return false;

      const htmlElem = elem as HTMLElement;
      return targetClasses.some((cls) => htmlElem.classList.contains(cls));
    };

    const searchInElement = (
      elem: Element,
      excludeBranch: Element | null,
      depth: number = 0,
    ): string | null => {
      if (depth > maxSiblingDepth) return null;

      if (elementMatches(elem)) {
        const txt = this._getText(elem as HTMLElement);
        if (txt) return txt;
      }

      for (const child of Array.from(elem.children)) {
        if (child === excludeBranch) continue;
        const result = searchInElement(child, null, depth + 1);
        if (result) return result;
      }

      return null;
    };

    let current: HTMLElement | null = el;
    let level = 0;

    while (current && level < maxAncestorLevels) {
      // Check the element itself
      if (elementMatches(current)) {
        const txt = this._getText(current);
        if (txt) return txt;
      }

      // Search next siblings (after the element) first - they are closer
      let sibling = current.nextElementSibling;
      while (sibling) {
        if (elementMatches(sibling)) {
          const txt = this._getText(sibling as HTMLElement);
          if (txt) return txt;
        }
        const result = searchInElement(sibling, null, 0);
        if (result) return result;
        sibling = sibling.nextElementSibling;
      }

      // Search previous siblings (before the element)
      sibling = current.previousElementSibling;
      while (sibling) {
        if (elementMatches(sibling)) {
          const txt = this._getText(sibling as HTMLElement);
          if (txt) return txt;
        }
        const result = searchInElement(sibling, null, 0);
        if (result) return result;
        sibling = sibling.previousElementSibling;
      }

      // If we're at the original element level, also search its children (descendants)
      if (level === 0) {
        for (const child of Array.from(current.children)) {
          const result = searchInElement(child, null, 0);
          if (result) return result;
        }
      }

      current = current.parentElement;
      level++;
    }

    return null;
  }

  // --------------------------------------------------------------------------
  // NODE BUILDING (merged logic)
  // --------------------------------------------------------------------------

  private _addProp(
    target: InteractiveElementNode | Record<string, unknown>,
    key: string,
    value: unknown,
  ): void {
    const record = target as Record<string, unknown>;
    if (value === undefined || value === null) {
      if (!this.config.omitNull) record[key] = null;
    } else {
      record[key] = value;
    }
  }

  private _buildInteractiveNode(
    el: HTMLElement,
    jsId?: string,
  ): InteractiveElementNode {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute("role");
    const ariaLabelAttr = el.getAttribute("aria-label");
    const isDropdownElement = this._hasDropdownClass(el);

    const node: InteractiveElementNode = {
      jsId: jsId || this._ensureJsId(el),
    };

    if (
      tag === "h1" ||
      tag === "h2" ||
      tag === "h3" ||
      tag === "h4" ||
      tag === "h5" ||
      tag === "h6"
    ) {
      this._addProp(node, "tag", tag);
      this._addProp(node, "textContent", this._getText(el));
      this._addProp(
        node,
        "nearestP",
        this._findNearestElementByTagAndClasses(el, ["p"]),
      );
      return node;
    }

    // Handle dropdown elements (minimal data)
    if (isDropdownElement) {
      this._addProp(node, "role", "button");
      let textContent: string | null = null;
      if (el.textContent) {
        const clone = el.cloneNode(true) as HTMLElement;
        const scripts = clone.querySelectorAll("script, noscript");
        scripts.forEach((script) => script.remove());
        textContent = clone.textContent?.trim() || null;
      }
      this._addProp(node, "textContent", textContent);
      this._addProp(node, "ariaLabel", this._getAriaLabel(el));
      // No context for dropdown elements
      this._addProp(node, "nearestP", null);
      this._addProp(node, "nearestSpan", null);
      this._addProp(node, "nearestH", null);
      this._addProp(node, "nearestLabel", null);
      return node;
    }

    // Add tag for non-dropdown elements
    node.tag = tag;

    // Add role if needed
    if (
      !this.config.interactiveElements.includes(tag) &&
      (role === "button" ||
        (ariaLabelAttr && ariaLabelAttr.trim().toLowerCase() === "button"))
    ) {
      this._addProp(node, "role", "button");
    }

    // Add type for inputs
    if (tag === "input") {
      const inputType = (el as HTMLInputElement).type || "text";
      node.type = inputType;
    }

    // Add element-specific data
    if (tag === "select") {
      const selectEl = el as HTMLSelectElement;
      const selectedOption = selectEl.options[selectEl.selectedIndex];
      const selectedText = selectedOption
        ? selectedOption.text
          ? selectedOption.text.trim()
          : null
        : null;
      this._addProp(node, "selectedElement", selectedText);

      const options = Array.from(selectEl.options || [])
        .map((opt) => (opt.text ? opt.text.trim() : null))
        .filter((text): text is string => text !== null);
      this._addProp(node, "options", options.length > 0 ? options : null);
    } else if (tag === "mat-select") {
      const selectedText = this._getText(el);
      this._addProp(node, "selectedOption", selectedText);
    } else {
      const inputEl = el as HTMLInputElement | HTMLTextAreaElement;
      const inputValue = inputEl.value;
      let valueToInclude: string | null = null;
      if (inputValue) {
        if (
          typeof inputValue === "object" ||
          String(inputValue) === "[object Object]"
        ) {
          valueToInclude = null;
        } else {
          valueToInclude = inputValue;
        }
      }
      this._addProp(node, "value", valueToInclude);

      let textContent: string | null = null;
      if (el.textContent) {
        const clone = el.cloneNode(true) as HTMLElement;
        const scripts = clone.querySelectorAll("script, noscript");
        scripts.forEach((script) => script.remove());
        textContent = clone.textContent?.trim() || null;
      }
      this._addProp(node, "textContent", textContent);
    }

    // Add checked for radio/checkbox
    if (tag === "input") {
      const inputType = ((el as HTMLInputElement).type || "").toLowerCase();
      if (inputType === "radio" || inputType === "checkbox") {
        this._addProp(
          node,
          "checked",
          (el as HTMLInputElement).checked || false,
        );
      }
    }

    // Add placeholder for writable elements
    if (this.isWritableElement(el)) {
      const inputEl = el as HTMLInputElement | HTMLTextAreaElement;
      this._addProp(node, "placeholder", inputEl.placeholder || null);
    }

    // Add href for anchors
    if (tag === "a") {
      const anchorEl = el as HTMLAnchorElement;
      this._addProp(node, "href", anchorEl.getAttribute("href"));
    }

    // Add aria-label
    this._addProp(node, "ariaLabel", this._getAriaLabel(el));

    // Attach context based on element type (merged from _attachContext)
    if (tag === "button" || tag === "a") {
      const nearestP = this._findNearestElementByTagAndClasses(
        el,
        ["p"],
        [],
        11,
        6,
      );
      const nearestH = this._findNearestElementByTagAndClasses(
        el,
        ["h1", "h2", "h3", "h4", "h5", "h6"],
        [],
        11,
        6,
      );
      this._addProp(node, "nearestP", nearestP);
      this._addProp(node, "nearestH", nearestH);
      this._addProp(node, "nearestLabel", null);
      // Only find nearestSpan if nearestP is null
      if (!nearestP) {
        const nearestSpan = this._findNearestElementByTagAndClasses(el, [
          "span",
        ]);
        this._addProp(node, "nearestSpan", nearestSpan);
      } else {
        this._addProp(node, "nearestSpan", null);
      }
    } else if (tag === "mat-option") {
      // No context for mat-option
      this._addProp(node, "nearestP", null);
      this._addProp(node, "nearestSpan", null);
      this._addProp(node, "nearestH", null);
      this._addProp(node, "nearestLabel", null);
    } else {
      // For input, select, textarea, mat-select: only get nearestLabel
      const nearestLabel = this._findNearestElementByTagAndClasses(el, [
        "label",
      ]);
      this._addProp(node, "nearestP", null);
      this._addProp(node, "nearestSpan", null);
      this._addProp(node, "nearestH", null);
      this._addProp(node, "nearestLabel", nearestLabel);
    }

    return node;
  }

  // --------------------------------------------------------------------------
  // COLLECTION & TRAVERSAL
  // --------------------------------------------------------------------------

  private _collectAllInteractiveElementsInOrder(
    root: HTMLElement,
  ): InteractiveElementNode[] {
    const list: InteractiveElementNode[] = [];
    const collectedJsIds = new Set<string>();

    const walk = (el: HTMLElement): void => {
      if (!el || el.nodeType !== 1) return;

      // Handle iframes
      const tag = el.tagName.toLowerCase();
      if (tag === "iframe") {
        try {
          const iframe = el as HTMLIFrameElement;
          const iframeDoc =
            iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc && iframeDoc.body) {
            walk(iframeDoc.body);
          }
        } catch {
          // Cross-origin iframe
        }
        Array.from(el.children).forEach((c) => walk(c as HTMLElement));
        return;
      }

      // Check if element should be included
      const insideExcluded = this._isInsideExcludedContainer(el);
      const isHidden = this._isHiddenElement(el);

      if (
        this.isInteractiveElement(el) &&
        !insideExcluded &&
        !isHidden &&
        this._shouldIncludeElement(el)
      ) {
        const jsId = el.getAttribute("data-js-id") || this._ensureJsId(el);

        if (!collectedJsIds.has(jsId)) {
          const node = this._buildInteractiveNode(el, jsId);
          list.push(node);
          collectedJsIds.add(jsId);
        }
      }

      // Handle shadow DOM
      if (el.shadowRoot) {
        Array.from(el.shadowRoot.children).forEach((c) =>
          walk(c as HTMLElement),
        );
      }

      // Walk regular children
      Array.from(el.children).forEach((c) => walk(c as HTMLElement));
    };

    walk(root);
    return list;
  }

  // --------------------------------------------------------------------------
  // PUBLIC API
  // --------------------------------------------------------------------------

  getInteractiveElementsAsJson(
    root: HTMLElement | null = typeof document !== "undefined"
      ? document.body
      : null,
    options: SerializerOptions = {},
  ): DOMElementsJSON {
    if (!root || root.nodeType !== 1) {
      throw new Error(`root must be an HTMLElement`);
    }

    // Clean up stale references
    this._cleanupStaleReferences();

    if (options.resetCounter) {
      this.resetCounters();
    } else {
      // Sync counter with DOM
      this.elementIdCounter = this._getCurrentMaxJsId();

      // Rebuild maps from DOM
      if (typeof document !== "undefined" && root) {
        const allElementsWithJsId = this._getAllElementsWithJsId(root);
        for (let i = 0; i < allElementsWithJsId.length; i++) {
          const el = allElementsWithJsId[i];
          const attrId = el.getAttribute("data-js-id");
          if (attrId) {
            const existingMapped = this._reverseIdMap.get(attrId);
            if (!existingMapped || existingMapped !== el) {
              if (existingMapped && existingMapped !== el) {
                this._idMap.delete(existingMapped);
              }
              this._idMap.set(el, attrId);
              this._reverseIdMap.set(attrId, el);
            }
          }
        }
      }
    }

    // Collect all interactive elements in DOM order
    const allInteractiveElements =
      this._collectAllInteractiveElementsInOrder(root);

    return {
      ts: new Date().toISOString(),
      url:
        typeof window !== "undefined" && window.location
          ? window.location.href
          : null,
      title: typeof document !== "undefined" ? document.title || null : null,
      nIntr: allInteractiveElements.length,
      interactiveElements: allInteractiveElements,
    };
  }

  getFlatInteractiveElements(
    root?: HTMLElement | null,
    options?: SerializerOptions,
  ): InteractiveElementNode[] {
    return this.getInteractiveElementsAsJson(root, options).interactiveElements;
  }

  printInteractiveElementsJson(root?: HTMLElement | null): DOMElementsJSON {
    const json = this.getInteractiveElementsAsJson(root);
    console.log(JSON.stringify(json, null, 2));
    return json;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

const serializerInstance = new InteractiveDomSerializer();

if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).InteractiveDomSerializer = serializerInstance;
}

export default serializerInstance;
