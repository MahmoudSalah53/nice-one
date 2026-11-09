import serializerInstance, {
  InteractiveElementNode,
  DOMElementsJSON,
} from "./interactiveDomSerializer";

/** Skip SPA stale nodes (hidden by ancestor display:none after soft-nav). */
function isElementVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const s = getComputedStyle(n);
    if (n.getAttribute("aria-hidden") === "true" || s.display === "none" || s.visibility === "hidden")
      return false;
  }
  return el.getClientRects().length > 0;
}

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface RegenDiffResult {
  snapshot: DOMElementsJSON;
  diff: DiffResult;
  isDifferent: boolean;
}

export interface DiffResult {
  added: InteractiveElementNode[];
  removed: InteractiveElementNode[];
  updated: InteractiveElementNode[];
}

type ChangeCallback = () => void;

type DetectorState =
  | { type: "idle" }
  | { type: "observing" }
  | { type: "waitingForStability"; startTime: number; url: string }
  | { type: "processingUrlChange"; url: string };

// ============================================================================
// DOMSnapshotManager - Handles snapshots and diffs
// ============================================================================

class DOMSnapshotManager {
  private lastSnapshot: DOMElementsJSON | null = null;

  getLastSnapshot(): DOMElementsJSON | null {
    return this.lastSnapshot;
  }

  createSnapshot(): DOMElementsJSON {
    const hostBody = document.body;
    if (!hostBody) {
      console.error("[DOM] Body not found");
      return this.getEmptySnapshot();
    }

    const snapshot = serializerInstance.getInteractiveElementsAsJson(hostBody, {
      resetCounter: true,
    });
    const visible = snapshot.interactiveElements.filter((n) => {
      const el = n.jsId
        ? document.querySelector<HTMLElement>(`[data-js-id="${CSS.escape(n.jsId)}"]`)
        : null;
      return !el || isElementVisible(el);
    });

    return visible.length === snapshot.interactiveElements.length
      ? snapshot
      : { ...snapshot, nIntr: visible.length, interactiveElements: visible };
  }

  updateSnapshot(snapshot: DOMElementsJSON): void {
    this.lastSnapshot = snapshot;
  }

  reset(): void {
    this.lastSnapshot = null;
  }

  calculateDiff(
    oldSnapshot: DOMElementsJSON,
    newSnapshot: DOMElementsJSON,
  ): DiffResult {
    const oldMap = this.flattenElements(oldSnapshot);
    const newMap = this.flattenElements(newSnapshot);

    const added: InteractiveElementNode[] = [];
    const removed: InteractiveElementNode[] = [];
    const updated: InteractiveElementNode[] = [];

    // Find added and updated elements
    for (const [id, newEl] of newMap) {
      const oldEl = oldMap.get(id);
      if (!oldEl) {
        added.push(newEl);
      } else if (JSON.stringify(oldEl) !== JSON.stringify(newEl)) {
        updated.push(newEl);
      }
    }

    // Find removed elements
    for (const [id, oldEl] of oldMap) {
      if (!newMap.has(id)) {
        removed.push(oldEl);
      }
    }

    return { added, removed, updated };
  }

  private flattenElements(
    snapshot: DOMElementsJSON,
  ): Map<string, InteractiveElementNode> {
    return new Map(snapshot.interactiveElements.map((el) => [el.jsId, el]));
  }

  private getEmptySnapshot(): DOMElementsJSON {
    return {
      ts: "",
      url: null,
      title: null,
      nIntr: 0,
      interactiveElements: [],
    };
  }
}

// ============================================================================
// MutationFilter - Determines if mutations are relevant
// ============================================================================

class MutationFilter {
  private readonly RELEVANT_ATTRS = new Set([
    "disabled",
    "value",
    "checked",
    "selected",
    "aria-label",
    "aria-disabled",
    "role",
    "contenteditable",
    "href",
    "type",
    "placeholder",
    "required",
    "readonly",
  ]);

  // Cache for interactive element checks
  private interactiveCache = new WeakMap<HTMLElement, boolean>();

  isRelevantMutation(mutations: MutationRecord[]): boolean {
    for (const mutation of mutations) {
      if (this.shouldIgnoreMutation(mutation)) {
        continue;
      }

      if (this.isMutationRelevant(mutation)) {
        return true;
      }
    }
    return false;
  }

  private shouldIgnoreMutation(mutation: MutationRecord): boolean {
    // Ignore our own data-js-id changes
    if (
      mutation.type === "attributes" &&
      mutation.attributeName === "data-js-id"
    ) {
      return true;
    }

    // Ignore changes inside booking-card divs
    const target = mutation.target as HTMLElement;
    if (
      target.nodeType === 1 &&
      target.closest &&
      target.closest(".booking-section")
    ) {
      return true;
    }

    return false;
  }

  private isMutationRelevant(mutation: MutationRecord): boolean {
    switch (mutation.type) {
      case "childList":
        return this.isChildListMutationRelevant(mutation);
      case "attributes":
        return this.isAttributeMutationRelevant(mutation);
      case "characterData":
        return this.isCharacterDataMutationRelevant(mutation);
      default:
        return false;
    }
  }

  private isChildListMutationRelevant(mutation: MutationRecord): boolean {
    const hasInteractiveAdded = Array.from(mutation.addedNodes).some((node) =>
      this.hasInteractiveElement(node),
    );

    const hasInteractiveRemoved = Array.from(mutation.removedNodes).some(
      (node) => this.hasInteractiveElement(node),
    );

    const target = mutation.target as HTMLElement;
    const targetIsInteractive =
      target.nodeType === 1 && this.isInteractiveElement(target);

    return hasInteractiveAdded || hasInteractiveRemoved || targetIsInteractive;
  }

  private isAttributeMutationRelevant(mutation: MutationRecord): boolean {
    const target = mutation.target as HTMLElement;
    return (
      target.nodeType === 1 &&
      this.isInteractiveElement(target) &&
      mutation.attributeName !== null &&
      this.RELEVANT_ATTRS.has(mutation.attributeName)
    );
  }

  private isCharacterDataMutationRelevant(mutation: MutationRecord): boolean {
    return this.isOrHasInteractiveAncestor(mutation.target);
  }

  private hasInteractiveElement(node: Node): boolean {
    if (node.nodeType !== 1) return false;
    const el = node as HTMLElement;

    if (this.isInteractiveElement(el)) return true;

    // Check only direct children first (optimization)
    const children = el.children;
    for (let i = 0; i < children.length; i++) {
      if (this.isInteractiveElement(children[i] as HTMLElement)) {
        return true;
      }
    }

    // If not found in direct children, do full search
    return Array.from(el.querySelectorAll("*")).some((descendant) =>
      this.isInteractiveElement(descendant as HTMLElement),
    );
  }

  private isOrHasInteractiveAncestor(node: Node): boolean {
    if (node.nodeType !== 1) return false;

    let current: HTMLElement | null = node as HTMLElement;
    while (current) {
      if (this.isInteractiveElement(current)) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  private isInteractiveElement(el: HTMLElement): boolean {
    // Check cache first
    const cached = this.interactiveCache.get(el);
    if (cached !== undefined) return cached;

    const result = serializerInstance?.isInteractiveElement(el) ?? false;
    this.interactiveCache.set(el, result);
    return result;
  }

  clearCache(): void {
    this.interactiveCache = new WeakMap<HTMLElement, boolean>();
  }
}

// ============================================================================
// DOMStabilityWaiter - Waits for DOM to stabilize
// ============================================================================

class DOMStabilityWaiter {
  private readonly DEFAULT_MAX_WAIT_MS = 3000;
  private readonly DEFAULT_POLL_INTERVAL_MS = 150;
  private readonly REQUIRED_STABLE_POLLS = 3;

  async waitForStability(
    maxWaitMs: number = this.DEFAULT_MAX_WAIT_MS,
    countFn?: () => number,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const startTime = Date.now();
      let lastCount: number | null = null;
      let stablePolls = 0;

      const check = (): void => {
        const currentCount = countFn
          ? countFn()
          : this.countInteractiveElements();
        const elapsed = Date.now() - startTime;

        if (lastCount !== null && currentCount === lastCount) {
          stablePolls++;
        } else {
          stablePolls = 0;
        }

        lastCount = currentCount;

        if (stablePolls >= this.REQUIRED_STABLE_POLLS) {
          console.log(`[DOM STABILITY] Achieved after ${elapsed}ms`);
          resolve();
        } else if (elapsed >= maxWaitMs) {
          console.log(`[DOM STABILITY] Timeout after ${elapsed}ms`);
          resolve();
        } else {
          setTimeout(check, this.DEFAULT_POLL_INTERVAL_MS);
        }
      };

      setTimeout(check, this.DEFAULT_POLL_INTERVAL_MS);
    });
  }

  private countInteractiveElements(): number {
    return document.querySelectorAll(
      'a, button, input, select, textarea, [role="button"], [onclick], mat-select, mat-option',
    ).length;
  }
}

// ============================================================================
// NavigationDetector - Detects URL changes
// ============================================================================

class NavigationDetector {
  private lastUrl: string | null = null;
  private onNavigationCallback: ((url: string) => void) | null = null;

  initialize(callback: (url: string) => void): void {
    this.onNavigationCallback = callback;
    this.lastUrl = this.getCurrentUrl();
    this.setupNavigationListeners();
    console.log("[NAVIGATION] Detector initialized");
  }

  getCurrentUrl(): string | null {
    return typeof window !== "undefined" && window.location
      ? window.location.href
      : null;
  }

  hasUrlChanged(): boolean {
    const currentUrl = this.getCurrentUrl();
    return (
      this.lastUrl !== null &&
      currentUrl !== null &&
      this.lastUrl !== currentUrl
    );
  }

  getLastUrl(): string | null {
    return this.lastUrl;
  }

  updateLastUrl(url: string | null): void {
    this.lastUrl = url;
  }

  private setupNavigationListeners(): void {
    if (typeof window === "undefined") return;

    // Popstate listener
    window.addEventListener("popstate", () => {
      console.log("[NAVIGATION] Popstate detected");
      this.checkAndNotifyUrlChange();
    });

    // Intercept history methods
    this.interceptHistoryMethod("pushState");
    this.interceptHistoryMethod("replaceState");

    console.log("[NAVIGATION] Listeners initialized");
  }

  private interceptHistoryMethod(
    methodName: "pushState" | "replaceState",
  ): void {
    const original = window.history[methodName].bind(window.history);
    const checkAndNotify = () => this.checkAndNotifyUrlChange();

    window.history[methodName] = function (
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ) {
      original(data, unused, url);
      console.log(`[NAVIGATION] ${methodName} detected`);
      setTimeout(checkAndNotify, 0);
    };
  }

  private checkAndNotifyUrlChange(): void {
    const currentUrl = this.getCurrentUrl();
    if (!currentUrl || !this.onNavigationCallback) return;

    if (this.lastUrl !== null && this.lastUrl !== currentUrl) {
      console.log(`[URL CHANGE] ${this.lastUrl} -> ${currentUrl}`);
      this.onNavigationCallback(currentUrl);
    }
  }
}

// ============================================================================
// Debouncer - Simple debouncing utility
// ============================================================================

class Debouncer {
  private timer: ReturnType<typeof setTimeout> | null = null;

  debounce(callback: () => void, delayMs: number): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(callback, delayMs);
  }

  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

// ============================================================================
// DOMChangeDetector - Orchestrates everything
// ============================================================================

class DOMChangeDetector {
  private state: DetectorState = { type: "idle" };

  private snapshotManager = new DOMSnapshotManager();
  private mutationFilter = new MutationFilter();
  private stabilityWaiter = new DOMStabilityWaiter();
  private navigationDetector = new NavigationDetector();
  private debouncer = new Debouncer();

  private observer: MutationObserver | null = null;
  private domChangeCallback: ChangeCallback | null = null;
  private urlChangeCallback: ChangeCallback | null = null;

  private readonly DEBOUNCE_DELAY_MS = 500;
  private readonly RECHECK_DELAY_MS = 200; // Delay for follow-up checks
  private pendingRecheck: ReturnType<typeof setTimeout> | null = null;

  // ---- Public API ----

  setDOMChangeCallback(callback: ChangeCallback | null): void {
    this.domChangeCallback = callback;
    console.log(`[DOM CHANGE] Callback ${callback ? "registered" : "cleared"}`);
  }

  setUrlChangeCallback(callback: ChangeCallback | null): void {
    this.urlChangeCallback = callback;
    console.log(`[URL CHANGE] Callback ${callback ? "registered" : "cleared"}`);
  }

  regenAndDiff(): RegenDiffResult {
    const lastSnapshot = this.snapshotManager.getLastSnapshot();
    const newSnapshot = this.snapshotManager.createSnapshot();

    // First run - store snapshot but DON'T return early
    // This ensures subsequent diffs work correctly
    if (!lastSnapshot) {
      this.snapshotManager.updateSnapshot(newSnapshot);
      // Treat first snapshot with elements as "different" so initial DOM is reported
      const hasElements = newSnapshot.interactiveElements.length > 0;
      if (hasElements) {
        console.log(
          `[DIFF] First snapshot: ${newSnapshot.interactiveElements.length} elements`,
        );
      }
      return {
        snapshot: newSnapshot,
        diff: {
          added: newSnapshot.interactiveElements,
          removed: [],
          updated: [],
        },
        isDifferent: hasElements,
      };
    }

    const diff = this.snapshotManager.calculateDiff(lastSnapshot, newSnapshot);
    const isDifferent =
      diff.added.length > 0 ||
      diff.removed.length > 0 ||
      diff.updated.length > 0;

    if (isDifferent) {
      console.log("[DIFF] Added", diff.added);
      console.log("[DIFF] Removed", diff.removed);
      console.log("[DIFF] Updated", diff.updated);
    }

    this.snapshotManager.updateSnapshot(newSnapshot);

    return { snapshot: newSnapshot, diff, isDifferent };
  }

  initialize(): void {
    // Take initial snapshot so first diff has baseline to compare
    const initialSnapshot = this.snapshotManager.createSnapshot();
    this.snapshotManager.updateSnapshot(initialSnapshot);
    console.log(
      `[DOM CHANGE DETECTOR] Initial snapshot: ${initialSnapshot.interactiveElements.length} elements`,
    );

    this.initializeMutationObserver();
    this.navigationDetector.initialize((url) => this.handleNavigation(url));
    this.state = { type: "observing" };
    console.log("[DOM CHANGE DETECTOR] Fully initialized");
  }

  collectSnapshot(): DOMElementsJSON {
    return this.snapshotManager.createSnapshot();
  }

  // ---- Private Methods ----

  private initializeMutationObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      if (this.mutationFilter.isRelevantMutation(mutations)) {
        this.handleDOMMutation();
      }
    });

    this.observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });

    console.log("[MUTATION OBSERVER] Initialized");
  }

  private handleDOMMutation(): void {
    // During URL transitions, queue a recheck for after transition completes
    // instead of silently dropping the change
    if (
      this.state.type === "waitingForStability" ||
      this.state.type === "processingUrlChange"
    ) {
      console.log("[DOM CHANGE] Queued - URL change in progress");
      this.scheduleRecheck();
      return;
    }

    this.debouncer.debounce(() => {
      this.processDOMChange();
    }, this.DEBOUNCE_DELAY_MS);
  }

  private processDOMChange(): void {
    // Skip if in URL transition state
    if (
      this.state.type === "waitingForStability" ||
      this.state.type === "processingUrlChange"
    ) {
      this.scheduleRecheck();
      return;
    }

    const result = this.regenAndDiff();
    if (result.isDifferent && this.domChangeCallback) {
      console.log("[DOM CHANGE] Triggering callback");
      this.domChangeCallback();
      // Schedule a follow-up check to catch cascading changes
      this.scheduleRecheck();
    }
  }

  private scheduleRecheck(): void {
    // Clear any pending recheck
    if (this.pendingRecheck) {
      clearTimeout(this.pendingRecheck);
    }
    // Schedule a new recheck after a short delay
    this.pendingRecheck = setTimeout(() => {
      this.pendingRecheck = null;
      // Only recheck if we're in observing state
      if (this.state.type === "observing") {
        const result = this.regenAndDiff();
        if (result.isDifferent && this.domChangeCallback) {
          console.log("[DOM CHANGE] Recheck - triggering callback");
          this.domChangeCallback();
          // Schedule another recheck in case there are more cascading changes
          this.scheduleRecheck();
        }
      } else {
        // Still not in observing state, schedule another recheck
        this.scheduleRecheck();
      }
    }, this.RECHECK_DELAY_MS);
  }

  private handleNavigation(newUrl: string): void {
    if (!this.urlChangeCallback) return;

    // Cancel any pending debounced DOM changes and rechecks
    this.debouncer.cancel();
    if (this.pendingRecheck) {
      clearTimeout(this.pendingRecheck);
      this.pendingRecheck = null;
    }

    console.log("[URL CHANGE] Processing navigation");
    this.state = {
      type: "waitingForStability",
      startTime: Date.now(),
      url: newUrl,
    };

    // Reset snapshot and update URL
    this.snapshotManager.reset();
    this.mutationFilter.clearCache();
    this.navigationDetector.updateLastUrl(newUrl);

    // Wait for filtered snapshot count to stabilize after SPA route swap
    this.stabilityWaiter
      .waitForStability(4000, () => this.snapshotManager.createSnapshot().nIntr)
      .then(() => {
        this.state = { type: "processingUrlChange", url: newUrl };

        const newPageSnapshot = this.snapshotManager.createSnapshot();
        this.snapshotManager.updateSnapshot(newPageSnapshot);
        console.log(
          `[URL CHANGE] New page snapshot: ${newPageSnapshot.interactiveElements.length} elements`,
        );

        if (this.urlChangeCallback) {
          console.log("[URL CHANGE] Triggering callback");
          this.urlChangeCallback();
        }

        setTimeout(() => {
          this.state = { type: "observing" };
          this.scheduleRecheck();
        }, 300);
      });
  }
}

// ============================================================================
// Singleton Instance & Public API
// ============================================================================

const detector = new DOMChangeDetector();

export const setAddedOrRemovedCallback =
  detector.setDOMChangeCallback.bind(detector);
export const setUrlChangeCallback =
  detector.setUrlChangeCallback.bind(detector);
export const regenAndDiff = detector.regenAndDiff.bind(detector);
export const collectDOMSnapshot = detector.collectSnapshot.bind(detector);

// Auto-initialize
detector.initialize();
