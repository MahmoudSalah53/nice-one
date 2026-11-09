import { cache } from "react";
import { APP_CONFIG_DEFAULTS } from "@/app-config";
import type { AppConfig, SandboxConfig } from "./types";

export const CONFIG_ENDPOINT = process.env.NEXT_PUBLIC_APP_CONFIG_ENDPOINT;
export const SANDBOX_ID = process.env.SANDBOX_ID;

export const THEME_STORAGE_KEY = "theme-mode";
export const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export function getOrigin(headers: Headers): string {
  const host = headers.get("host");
  const proto = headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

export function getSandboxId(origin: string) {
  return SANDBOX_ID ?? origin;
}

// Server-side cached version (uses React cache)
export const getAppConfig = cache(
  async (origin: string, sandboxIdAttribute?: string): Promise<AppConfig> => {
    const sandboxId = sandboxIdAttribute ?? getSandboxId(origin);
    const config: AppConfig = { ...APP_CONFIG_DEFAULTS, sandboxId };

    if (CONFIG_ENDPOINT) {
      try {
        const response = await fetch(CONFIG_ENDPOINT, {
          cache: "no-store",
          headers: { "X-Sandbox-ID": sandboxId },
        });

        const remoteConfig: SandboxConfig = await response.json();

        for (const [key, entry] of Object.entries(remoteConfig)) {
          if (entry === null) continue;
          if (
            key in config &&
            typeof config[key as keyof AppConfig] === entry.type &&
            typeof config[key as keyof AppConfig] === typeof entry.value
          ) {
            // @ts-expect-error I'm not sure quite how to appease TypeScript, but we've thoroughly checked types above
            config[key as keyof AppConfig] =
              entry.value as AppConfig[keyof AppConfig];
          }
        }
      } catch (error) {
        console.error("Error fetching remote config:", error);
      }
    }

    return config;
  },
);

// Client-side version (for use in browser/standalone bundle)
export async function getAppConfigClient(
  origin: string,
  sandboxIdAttribute?: string,
): Promise<AppConfig> {
  const sandboxId = sandboxIdAttribute ?? getSandboxId(origin);
  const config: AppConfig = { ...APP_CONFIG_DEFAULTS, sandboxId };

  if (CONFIG_ENDPOINT) {
    try {
      // Use sandbox ID as origin if it's a full URL
      const configOrigin =
        sandboxId &&
        (sandboxId.startsWith("http://") || sandboxId.startsWith("https://"))
          ? sandboxId
          : origin;

      const configUrl = new URL(CONFIG_ENDPOINT, configOrigin);
      const response = await fetch(configUrl.toString(), {
        cache: "no-store",
        headers: { "X-Sandbox-ID": sandboxId },
      });

      const remoteConfig: SandboxConfig = await response.json();

      for (const [key, entry] of Object.entries(remoteConfig)) {
        if (entry === null) continue;
        if (
          key in config &&
          typeof config[key as keyof AppConfig] === entry.type &&
          typeof config[key as keyof AppConfig] === typeof entry.value
        ) {
          // @ts-expect-error I'm not sure quite how to appease TypeScript, but we've thoroughly checked types above
          config[key as keyof AppConfig] =
            entry.value as AppConfig[keyof AppConfig];
        }
      }
    } catch (error) {
      console.error("Error fetching remote config:", error);
    }
  }

  return config;
}
