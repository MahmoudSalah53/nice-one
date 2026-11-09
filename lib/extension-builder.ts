/**
 * Node Extension Builder — build and zip the Nice One Chrome extension
 * with a configured embed server URL.
 */

import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import archiver from "archiver";
import {
  DEFAULT_EMBED_SERVER_URL,
  NODE_EXTENSION_DIR,
  NODE_EXTENSION_NAME,
} from "./extension-builder-constants";

export { DEFAULT_EMBED_SERVER_URL, NODE_EXTENSION_NAME, NODE_EXTENSION_DIR };

const EXTENSION_FILES = [
  "background.js",
  "content-script.js",
  "csp-remover.js",
  "csp-rules.json",
  "fetch-proxy.js",
  "iframe-wrapper.html",
  "iframe-wrapper.js",
  "manifest.json",
  "options.html",
  "options.js",
  "popup.html",
  "popup.js",
];

const FILES_WITH_SERVER_URL = [
  "background.js",
  "content-script.js",
  "options.js",
  "options.html",
  "iframe-wrapper.js",
];

const BUNDLE_FILES = ["embed-popup.js", "page-automation.js"] as const;

export interface BuildExtensionOptions {
  serverUrl: string;
  extensionName?: string;
}

export interface BuildExtensionResult {
  success: boolean;
  error?: string;
  zipBuffer?: Buffer;
  verification?: VerificationResult;
}

export interface VerificationResult {
  variant: "node";
  serverUrl: string;
  extensionName: string;
  extensionDir: string;
  filesInZip: string[];
  urlReplacedInFiles: string[];
  buildOutputFiles: string[];
  checks: {
    webpackBuildSucceeded: boolean;
    embedPopupJsInZip: boolean;
    pageAutomationJsInZip: boolean;
    serverUrlReplaced: boolean;
    bundlesCopiedToExtensionDir: boolean;
  };
}

export function validateServerUrl(url: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: false, error: "Server URL is required" };
  }
  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, error: "Server URL must use http or https" };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid Server URL format" };
  }
}

function resolveExtensionDir(cwd: string): string | null {
  const primary = path.join(cwd, NODE_EXTENSION_DIR);
  const fallback = path.join(cwd, "..", NODE_EXTENSION_DIR);
  if (fs.existsSync(primary)) return primary;
  if (fs.existsSync(fallback)) return fallback;
  return null;
}

function runWebpackBuild(
  cwd: string,
): Promise<{ success: boolean; stderr: string; stdout: string }> {
  return new Promise((resolve) => {
    const child = spawn("pnpm", ["run", "build-embed-popup-script"], {
      cwd,
      env: process.env,
      shell: true,
    });

    let stderr = "";
    let stdout = "";

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });
    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.on("close", (code) => {
      resolve({
        success: code === 0,
        stderr,
        stdout,
      });
    });

    child.on("error", (err) => {
      resolve({
        success: false,
        stderr: err.message,
        stdout,
      });
    });
  });
}

function replaceDefaultServerUrl(content: string, serverUrl: string): string {
  return content.split(DEFAULT_EMBED_SERVER_URL).join(serverUrl);
}

function copyBundlesToExtensionDir(
  extensionDir: string,
  publicDir: string,
): boolean {
  try {
    for (const fileName of BUNDLE_FILES) {
      const src = path.join(publicDir, fileName);
      if (!fs.existsSync(src)) continue;
      fs.copyFileSync(src, path.join(extensionDir, fileName));
      const mapSrc = `${src}.map`;
      if (fs.existsSync(mapSrc)) {
        fs.copyFileSync(mapSrc, path.join(extensionDir, `${fileName}.map`));
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function buildExtensionZip(
  options: BuildExtensionOptions,
): Promise<BuildExtensionResult> {
  const { serverUrl, extensionName = NODE_EXTENSION_NAME } = options;

  const urlValidation = validateServerUrl(serverUrl);
  if (!urlValidation.valid) {
    return { success: false, error: urlValidation.error };
  }
  const normalizedServerUrl = serverUrl.trim().replace(/\/+$/, "");

  const cwd = process.cwd();
  const resolvedExtensionDir = resolveExtensionDir(cwd);
  const publicDir = path.join(cwd, "public");

  if (!resolvedExtensionDir) {
    return {
      success: false,
      error: `Extension directory not found: ${path.join(cwd, NODE_EXTENSION_DIR)}`,
    };
  }

  const buildResult = await runWebpackBuild(cwd);
  if (!buildResult.success) {
    return {
      success: false,
      error: `Webpack build failed: ${buildResult.stderr || buildResult.stdout}`,
    };
  }

  const embedPopupPath = path.join(publicDir, "embed-popup.js");
  const pageAutomationPath = path.join(publicDir, "page-automation.js");

  if (!fs.existsSync(embedPopupPath)) {
    return {
      success: false,
      error: "embed-popup.js was not produced by build",
    };
  }

  const bundlesCopied = copyBundlesToExtensionDir(
    resolvedExtensionDir,
    publicDir,
  );

  const filesInZip: string[] = [];
  const urlReplacedInFiles: string[] = [];

  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("error", (err: Error) => {
      resolve({ success: false, error: err.message });
    });
    archive.on("end", () => {
      const zipBuffer = Buffer.concat(chunks);
      const verification: VerificationResult = {
        variant: "node",
        serverUrl: normalizedServerUrl,
        extensionName,
        extensionDir: resolvedExtensionDir,
        filesInZip: [...filesInZip].sort(),
        urlReplacedInFiles: [...urlReplacedInFiles].sort(),
        buildOutputFiles: [...BUNDLE_FILES].filter((f) =>
          filesInZip.includes(f),
        ),
        checks: {
          webpackBuildSucceeded: buildResult.success,
          embedPopupJsInZip: filesInZip.includes("embed-popup.js"),
          pageAutomationJsInZip: filesInZip.includes("page-automation.js"),
          serverUrlReplaced: urlReplacedInFiles.length > 0,
          bundlesCopiedToExtensionDir: bundlesCopied,
        },
      };
      resolve({
        success: true,
        zipBuffer,
        verification,
      });
    });

    for (const fileName of EXTENSION_FILES) {
      const filePath = path.join(resolvedExtensionDir, fileName);
      if (!fs.existsSync(filePath)) continue;

      let content = fs.readFileSync(filePath, "utf8");
      if (FILES_WITH_SERVER_URL.includes(fileName)) {
        const replaced = replaceDefaultServerUrl(content, normalizedServerUrl);
        if (replaced !== content) {
          urlReplacedInFiles.push(fileName);
        }
        content = replaced;
      }

      if (fileName === "manifest.json") {
        try {
          const manifest = JSON.parse(content);
          manifest.name = extensionName;
          manifest.description =
            "Voice agent embed for Nice One websites (niceonesa.com)";
          content = JSON.stringify(manifest, null, 2);
        } catch {
          // keep original
        }
      }

      archive.append(content, { name: fileName });
      filesInZip.push(fileName);
    }

    if (fs.existsSync(embedPopupPath)) {
      archive.file(embedPopupPath, { name: "embed-popup.js" });
      filesInZip.push("embed-popup.js");
    }
    if (fs.existsSync(pageAutomationPath)) {
      archive.file(pageAutomationPath, { name: "page-automation.js" });
      filesInZip.push("page-automation.js");
    }

    archive.finalize();
  });
}
