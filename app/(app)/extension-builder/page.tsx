"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  NODE_EXTENSION_NAME,
  NODE_EXTENSION_ZIP_BASENAME,
  NODA_SITES_LABEL,
} from "@/lib/extension-builder-constants";

const PROGRESS_TARGET = 92;
const PROGRESS_DURATION_MS = 22000;

export default function ExtensionBuilderPage() {
  const [serverUrl, setServerUrl] = useState<string>("");
  const [status, setStatus] = useState<
    "idle" | "building" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [verification, setVerification] = useState<Record<
    string,
    unknown
  > | null>(null);
  const progressStartRef = useRef<number>(0);
  const progressRafRef = useRef<number>(0);
  const buildingRef = useRef(false);

  const buildAndDownload = useCallback(async () => {
    const url = serverUrl.trim();
    if (!url) {
      setStatus("error");
      setMessage("Server URL is required");
      return;
    }
    buildingRef.current = true;
    setStatus("building");
    setMessage("");
    setProgress(0);
    setVerification(null);
    progressStartRef.current = Date.now();

    const tick = () => {
      if (!buildingRef.current) return;
      const elapsed = Date.now() - progressStartRef.current;
      const p = Math.min(
        PROGRESS_TARGET * (1 - Math.exp(-elapsed / (PROGRESS_DURATION_MS / 3))),
        PROGRESS_TARGET,
      );
      setProgress(Math.round(p));
      progressRafRef.current = requestAnimationFrame(tick);
    };
    progressRafRef.current = requestAnimationFrame(tick);

    try {
      const res = await fetch("/api/build-extension", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverUrl: url,
          extensionName: NODE_EXTENSION_NAME,
        }),
      });

      buildingRef.current = false;
      cancelAnimationFrame(progressRafRef.current);

      const verificationHeader = res.headers.get(
        "X-Extension-Build-Verification",
      );
      if (verificationHeader) {
        try {
          setVerification(
            JSON.parse(verificationHeader) as Record<string, unknown>,
          );
        } catch {
          // ignore
        }
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setMessage(data?.error ?? `Request failed: ${res.status}`);
        return;
      }

      const blob = await res.blob();
      const filename =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
        `${NODE_EXTENSION_ZIP_BASENAME}.zip`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);

      setProgress(100);
      setStatus("success");
      setMessage(
        `Downloaded ${filename}. Unzip and load the folder in Chrome → Extensions → Load unpacked.`,
      );
    } catch (e) {
      buildingRef.current = false;
      cancelAnimationFrame(progressRafRef.current);
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Build failed");
    }
  }, [serverUrl]);

  return (
    <div className="dark bg-black min-h-screen">
      <div className="mx-auto flex max-w-prose flex-col py-8 px-4 text-zinc-400">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Nice One Builder</h1>
          <Link
            href="/"
            className="text-sm font-medium text-zinc-500 underline underline-offset-4 transition-colors hover:text-white"
          >
            ← Home
          </Link>
        </div>

        <p className="mb-2 text-sm text-zinc-500">
          Build <strong className="text-zinc-300">{NODE_EXTENSION_NAME}</strong>{" "}
          for <strong className="text-zinc-300">{NODA_SITES_LABEL}</strong> only.
        </p>
        <p className="mb-6 text-xs text-zinc-600">
          Runs webpack (node serializer), packages <code className="text-zinc-500">node-extension/</code>, and
          bakes your server URL into the extension defaults.
        </p>

        <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div>
            <label
              htmlFor="serverUrl"
              className="mb-1 block font-medium text-zinc-200"
            >
              Embed server URL
            </label>
            <input
              id="serverUrl"
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://your-frontend.example.com"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-200 transition-all focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <p className="mt-1.5 text-xs text-zinc-600">
              Replaces <code className="text-zinc-500">http://localhost:3000</code> in
              extension options and background defaults.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-500">
            Extension name:{" "}
            <span className="font-medium text-zinc-300">{NODE_EXTENSION_NAME}</span>
          </div>

          <button
            type="button"
            onClick={buildAndDownload}
            disabled={status === "building"}
            className="w-full cursor-pointer rounded-lg bg-white px-4 py-3 font-semibold text-black transition-all hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "building"
              ? "Building Nice One…"
              : "Build & Download Nice One"}
          </button>
        </div>

        {status === "building" && (
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-zinc-400">Building…</span>
              <span className="font-medium tabular-nums text-white">
                {progress}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {message && (
          <div
            className={`mt-4 rounded-lg border p-4 text-sm ${
              status === "error"
                ? "border-red-900/50 bg-red-900/10 text-red-400"
                : status === "success"
                  ? "border-emerald-900/50 bg-emerald-900/10 text-emerald-400"
                  : "border-zinc-800 text-zinc-400"
            }`}
          >
            {message}
          </div>
        )}

        {verification && Object.keys(verification).length > 0 && (
          <details className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 text-zinc-500">
            <summary className="cursor-pointer font-medium transition-colors hover:text-zinc-300">
              Build verification
            </summary>
            <pre className="mt-2 overflow-auto rounded border border-zinc-800 bg-black/50 p-2 text-xs text-zinc-400">
              {JSON.stringify(verification, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
