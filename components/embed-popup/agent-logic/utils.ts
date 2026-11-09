import Cookies from "js-cookie";
import { HEARTBEAT_KEY, HEARTBEAT_STALE_THRESHOLD_MS } from "./config";

// Helper function to get domain for cookies (shared across subdomains)
export const getCookieDomain = (): string | undefined => {
    if (typeof window === "undefined") return undefined;
    const hostname = window.location.hostname;
    // If localhost or IP, don't set domain
    if (hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
        return undefined;
    }

    const parts = hostname.split(".");

    // Handle multi-part TLDs (e.g., .org.sa, .com.sa, .edu.sa, .co.uk, .com.au)
    // These have a second-level domain before the country code
    const knownSecondLevelTLDs = ["org", "com", "edu", "gov", "net", "co", "ac", "sch"];

    if (parts.length >= 3) {
        const secondToLast = parts[parts.length - 2];
        // If second-to-last part is a known second-level TLD (like "org" in "scfhs.org.sa")
        // then take 3 parts to get the actual domain
        if (knownSecondLevelTLDs.includes(secondToLast.toLowerCase())) {
            return `.${parts.slice(-3).join(".")}`;
        }
    }

    // For regular domains (e.g., example.com), take last 2 parts
    if (parts.length >= 2) {
        return `.${parts.slice(-2).join(".")}`;
    }
    return undefined;
};

// Cookie options for cross-subdomain sharing
export const getCookieOptions = () => ({
    domain: getCookieDomain(),
    path: "/",
    sameSite: "none" as const,
    secure: true,
});

// Check if there's an active tab by looking at heartbeat
export const isHeartbeatStale = (): boolean => {
    try {
        const heartbeat = Cookies.get(HEARTBEAT_KEY);
        if (!heartbeat) return true;

        const lastHeartbeat = parseInt(heartbeat, 10);
        if (isNaN(lastHeartbeat)) return true;

        const now = Date.now();
        return (now - lastHeartbeat) > HEARTBEAT_STALE_THRESHOLD_MS;
    } catch {
        return true;
    }
};
