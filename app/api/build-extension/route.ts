/**
 * API: Build Node Extension zip on-demand.
 * POST body: { serverUrl: string, extensionName?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  buildExtensionZip,
  validateServerUrl,
  NODE_EXTENSION_NAME,
} from "@/lib/extension-builder";
import { NODE_EXTENSION_ZIP_BASENAME } from "@/lib/extension-builder-constants";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const serverUrl = (body?.serverUrl ?? "").toString().trim();
    const extensionName = (body?.extensionName ?? NODE_EXTENSION_NAME)
      .toString()
      .trim();

    const urlCheck = validateServerUrl(serverUrl);
    if (!urlCheck.valid) {
      return NextResponse.json(
        { success: false, error: urlCheck.error },
        { status: 400 },
      );
    }

    const result = await buildExtensionZip({
      serverUrl,
      extensionName: extensionName || NODE_EXTENSION_NAME,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 },
      );
    }

    if (!result.zipBuffer) {
      return NextResponse.json(
        { success: false, error: "Build produced no zip" },
        { status: 500 },
      );
    }

    const filename = `${NODE_EXTENSION_ZIP_BASENAME}.zip`;
    return new NextResponse(new Uint8Array(result.zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(result.zipBuffer.length),
        "X-Extension-Build-Verification": JSON.stringify(
          result.verification ?? {},
        ),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    description: "Build Nice One (niceonesa.com)",
    method: "POST",
    body: {
      serverUrl: "string (required). e.g. https://your-deployed-frontend.com",
      extensionName: `string (optional). Default: ${NODE_EXTENSION_NAME}`,
    },
    response: "application/zip on success, JSON error on failure",
  });
}
