/**
 * Page URL helpers for embed/iframe context.
 * Serializer version is always "node" (Nice One only).
 */

export type SerializerVersionKey = "node";

let currentPageUrl: string | null = null;

export function setCurrentPageUrl(url: string | null): void {
  currentPageUrl = url;
}

export function getCurrentPageUrl(): string | null {
  return currentPageUrl;
}

/** URL to use for DOM context: explicit currentPageUrl or, in browser, window.location.href. */
export function getResolvedUrl(): string {
  if (typeof currentPageUrl === "string" && currentPageUrl.length > 0) {
    return currentPageUrl;
  }
  if (typeof window !== "undefined" && window.location?.href) {
    return window.location.href;
  }
  return "";
}

export function getSerializerVersionFromUrl(_url?: string): SerializerVersionKey {
  return "node";
}
