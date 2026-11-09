import { useCallback, useEffect, useState, useRef } from "react";
import { decodeJwt } from "jose";
import Cookies from "js-cookie";
import { ConnectionDetails } from "@/app/api/connection-details/route";
import { AppConfig } from "@/lib/types";
import {
  getResolvedUrl,
  getSerializerVersionFromUrl,
} from "@/utils/serializerVersionFromUrl";

const ONE_MINUTE_IN_MILLISECONDS = 60 * 1000;
const SESSION_STORAGE_KEY = "livekit_connection_details";

// Helper function to get domain for cookies (shared across subdomains)
const getCookieDomain = (): string | undefined => {
  if (typeof window === "undefined") return undefined;
  const hostname = window.location.hostname;
  // If localhost or IP, don't set domain
  if (hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return undefined;
  }

  const parts = hostname.split(".");

  // Handle multi-part TLDs (e.g., .org.sa, .com.sa, .edu.sa, .co.uk, .com.au)
  // These have a second-level domain before the country code
  const knownSecondLevelTLDs = [
    "org",
    "com",
    "edu",
    "gov",
    "net",
    "co",
    "ac",
    "sch",
  ];

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
const getCookieOptions = () => ({
  domain: getCookieDomain(),
  path: "/",
  sameSite: "none" as const,
  secure: true,
});

export default function useConnectionDetails(appConfig: AppConfig) {
  // Generate room connection details, including:
  //   - A random Room name
  //   - A random Participant name
  //   - An Access Token to permit the participant to join the room
  //   - The URL of the LiveKit server to connect to
  //
  // In real-world application, you would likely allow the user to specify their
  // own participant name, and possibly to choose from existing rooms to join.

  // Guard against concurrent fetches
  const isFetchingRef = useRef(false);
  // Ref to store stable appConfig values
  const appConfigRef = useRef(appConfig);
  appConfigRef.current = appConfig;

  // Try to load connection details from cookies on initialization
  const loadStoredConnectionDetails =
    useCallback((): ConnectionDetails | null => {
      // Check if we're in the browser (cookies are not available on the server)
      if (typeof window === "undefined") {
        return null;
      }

      try {
        // Check if there's an active tab by looking at heartbeat
        // Note: agent-client.tsx handles the initial stale check on mount
        // This is a secondary check for the hook
        const stored = Cookies.get(SESSION_STORAGE_KEY);
        if (!stored) {
          return null;
        }

        const details: ConnectionDetails = JSON.parse(stored);

        // Check if token is expired
        if (!details.participantToken) {
          return null;
        }

        const jwtPayload = decodeJwt(details.participantToken);
        if (!jwtPayload.exp) {
          return null;
        }

        // Check if token expires within the next minute
        // jwtPayload.exp is in seconds (Unix timestamp), convert to milliseconds
        const expiresAtMs =
          (jwtPayload.exp - ONE_MINUTE_IN_MILLISECONDS / 1000) * 1000;
        const expiresAt = new Date(expiresAtMs);
        const now = new Date();

        if (expiresAt <= now) {
          console.log(
            "[CONNECTION DETAILS] Stored token is expired, will fetch new one",
          );
          Cookies.remove(SESSION_STORAGE_KEY, getCookieOptions());
          return null;
        }

        console.log(
          "[CONNECTION DETAILS] Loaded connection details from cookies:",
          {
            serverUrl: details.serverUrl,
            roomName: details.roomName,
            participantName: details.participantName,
          },
        );
        return details;
      } catch (error) {
        console.warn(
          "[CONNECTION DETAILS] Error loading stored connection details:",
          error,
        );
        if (typeof window !== "undefined") {
          Cookies.remove(SESSION_STORAGE_KEY, getCookieOptions());
        }
        return null;
      }
    }, []);

  // Initialize with null on server, load from cookies on client
  const [connectionDetails, setConnectionDetails] =
    useState<ConnectionDetails | null>(null);

  // Load from cookies on client-side mount
  useEffect(() => {
    const stored = loadStoredConnectionDetails();
    if (stored) {
      setConnectionDetails(stored);
    }
  }, [loadStoredConnectionDetails]);
  const [error, setError] = useState<Error | null>(null);

  const fetchConnectionDetails = useCallback(
    async (existingRoomName?: string) => {
      // Guard against concurrent fetches
      if (isFetchingRef.current) {
        console.log("[CONNECTION DETAILS] Fetch already in progress, skipping");
        return null;
      }

      isFetchingRef.current = true;
      setError(null);
      // NOTE: We no longer set connectionDetails to null here to avoid triggering re-fetches
      // The state will be updated when the fetch completes

      // Use stable ref for appConfig
      const config = appConfigRef.current;

      // Use sandbox ID as the origin (it's the Next.js server URL)
      // If sandbox ID is not a full URL, fall back to window.location.origin
      const apiOrigin =
        config.sandboxId &&
        (config.sandboxId.startsWith("http://") ||
          config.sandboxId.startsWith("https://"))
          ? config.sandboxId
          : window.location.origin;

      const url = new URL(
        process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ??
          "/api/connection-details",
        apiOrigin,
      );

      console.log("[CONNECTION DETAILS] Starting fetch:", {
        url: url.toString(),
        apiOrigin,
        sandboxId: config.sandboxId,
      });

      let data: ConnectionDetails;
      try {
        console.log(
          "[CONNECTION DETAILS] Making fetch request to:",
          url.toString(),
        );

        // Use extension proxy if available (for Chrome extension context)
        const win = window as unknown as {
          __voiceAgentFetchProxy?: typeof fetch;
        };
        const fetchFn = win.__voiceAgentFetchProxy || fetch;
        const isUsingProxy = !!win.__voiceAgentFetchProxy;

        if (isUsingProxy) {
          console.log("[CONNECTION DETAILS] Using extension fetch proxy");
        }

        const res = await fetchFn(url.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Sandbox-Id": config.sandboxId ?? "",
          },
          body: JSON.stringify({
            room_config: config.agentName
              ? {
                  agents: [{ agent_name: config.agentName }],
                }
              : undefined,
            room_name: existingRoomName, // Send existing room name to reuse it
            serializer_version:
              typeof window !== "undefined"
                ? getSerializerVersionFromUrl(getResolvedUrl())
                : undefined,
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error(
            "❌ Error fetching connection details:",
            res.status,
            res.statusText,
          );
          console.error("Error response:", errorText);
          console.error("API URL:", url.toString());
          console.error("Sandbox ID:", config.sandboxId);
          console.error("App Config:", config);
          throw new Error(
            `Failed to fetch connection details: ${res.status} ${res.statusText} - ${errorText}`,
          );
        }

        console.log("[CONNECTION DETAILS] Response received:", {
          status: res.status,
          statusText: res.statusText,
          ok: res.ok,
        });
        data = await res.json();
        console.log("✅ Connection details fetched successfully:", {
          serverUrl: data.serverUrl,
          roomName: data.roomName,
          participantName: data.participantName,
        });
      } catch (error) {
        console.error("❌ Error fetching connection details:", error);
        console.error("API URL:", url.toString());
        console.error("API Origin:", apiOrigin);
        console.error("Sandbox ID:", config.sandboxId);
        console.error("App Config:", config);
        const errorObj =
          error instanceof Error
            ? error
            : new Error("Error fetching connection details!");
        setError(errorObj);
        isFetchingRef.current = false;
        throw errorObj;
      }

      setConnectionDetails(data);
      setError(null);
      isFetchingRef.current = false;

      // Store connection details in cookies
      try {
        Cookies.set(
          SESSION_STORAGE_KEY,
          JSON.stringify(data),
          getCookieOptions(),
        );
        console.log(
          "[CONNECTION DETAILS] Stored connection details in cookies",
        );
      } catch (error) {
        console.warn(
          "[CONNECTION DETAILS] Failed to store connection details in cookies:",
          error,
        );
      }

      return data;
    },
    [], // No dependencies - using refs for stability
  );

  // Flag to track if initial fetch has been attempted
  const hasInitialFetchRef = useRef(false);

  useEffect(() => {
    // Only fetch once on initial mount if we don't have valid stored connection details
    if (!connectionDetails && !hasInitialFetchRef.current) {
      hasInitialFetchRef.current = true;

      // Check cookies for existing room name before creating new one
      // This prevents creating a new room when popup is open and page reloads
      let roomNameToReuse: string | undefined;
      try {
        const stored = Cookies.get(SESSION_STORAGE_KEY);
        if (stored) {
          const details: ConnectionDetails = JSON.parse(stored);
          roomNameToReuse = details.roomName;
          console.log(
            "[CONNECTION DETAILS] Found room name in cookies, reusing:",
            roomNameToReuse,
          );
        }
      } catch (error) {
        // Ignore errors, proceed with new room
        console.warn(
          "[CONNECTION DETAILS] Error reading cookies in useEffect:",
          error,
        );
      }

      fetchConnectionDetails(roomNameToReuse).catch((err) => {
        console.error("Failed to fetch connection details in useEffect:", err);
        // Reset flag on error so it can retry
        hasInitialFetchRef.current = false;
      });
    }
  }, [fetchConnectionDetails, connectionDetails]);

  // Helper to check if a token is expired
  const isTokenExpired = useCallback((token: string): boolean => {
    try {
      const jwtPayload = decodeJwt(token);
      if (!jwtPayload.exp) {
        return true;
      }
      // jwtPayload.exp is in seconds (Unix timestamp), convert to milliseconds
      const expiresAtMs =
        (jwtPayload.exp - ONE_MINUTE_IN_MILLISECONDS / 1000) * 1000;
      const expiresAt = new Date(expiresAtMs);
      const now = new Date();
      // Return true if expired (expiresAt is in the past or now)
      return expiresAt <= now;
    } catch {
      return true;
    }
  }, []);

  const existingOrRefreshConnectionDetails = useCallback(async () => {
    // If a fetch is already in progress, wait for it and return current details
    if (isFetchingRef.current) {
      console.log(
        "[CONNECTION DETAILS] Fetch in progress, waiting for current connectionDetails",
      );
      // Return current connectionDetails or wait a bit and try again
      if (connectionDetails) {
        return connectionDetails;
      }
      // Wait for the fetch to complete (simple polling)
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (connectionDetails) {
        return connectionDetails;
      }
    }

    // First check if we have stored details that are still valid
    const stored = loadStoredConnectionDetails();
    if (stored) {
      setConnectionDetails(stored);
      // Check if stored token is expired
      if (stored.participantToken && isTokenExpired(stored.participantToken)) {
        console.log(
          "[CONNECTION DETAILS] Stored token expired, refreshing but reusing room:",
          stored.roomName,
        );
        return fetchConnectionDetails(stored.roomName);
      }
      return stored;
    }

    // If cookies are empty (manually closed), don't reuse current connectionDetails
    // Fetch a new one without room name to create a new session
    // Check if cookies are empty
    const hasStoredDetails = Cookies.get(SESSION_STORAGE_KEY);
    if (!hasStoredDetails) {
      // Cookies are empty - this means manual close happened
      // Don't reuse current connectionDetails, fetch a new one
      console.log(
        "[CONNECTION DETAILS] Cookies empty (manual close), fetching new connection details",
      );
      return fetchConnectionDetails(); // No room name = new room
    }

    // Otherwise check current connection details
    if (
      !connectionDetails ||
      (connectionDetails.participantToken &&
        isTokenExpired(connectionDetails.participantToken))
    ) {
      // If we have connection details but token expired, reuse the room name
      const roomNameToReuse = connectionDetails?.roomName;
      return fetchConnectionDetails(roomNameToReuse);
    } else {
      return connectionDetails;
    }
  }, [
    connectionDetails,
    fetchConnectionDetails,
    isTokenExpired,
    loadStoredConnectionDetails,
  ]);

  return {
    connectionDetails,
    error,
    refreshConnectionDetails: fetchConnectionDetails,
    existingOrRefreshConnectionDetails,
  };
}
