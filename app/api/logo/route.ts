import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET(req: Request) {
  try {
    // Get the logo filename from query params or default to lk-logo.svg
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("file") || "lk-logo.svg";

    // Only allow logo files for security
    if (!filename.match(/^lk-logo(-dark)?\.svg$/)) {
      return new NextResponse("Not found", { status: 404 });
    }

    // Read the logo file from public directory
    const filePath = join(process.cwd(), "public", filename);
    const fileContent = await readFile(filePath, "utf-8");

    // Return with CORS headers
    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error serving logo:", error);
    return new NextResponse("Not found", { status: 404 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
