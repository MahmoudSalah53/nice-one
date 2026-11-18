import { handleNiceOneProxyRequest } from "@/lib/niceone-proxy";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug?: string[] }> },
) {
  const { slug } = await context.params;
  return handleNiceOneProxyRequest(request, "ar", slug);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug?: string[] }> },
) {
  const { slug } = await context.params;
  return handleNiceOneProxyRequest(request, "ar", slug);
}
