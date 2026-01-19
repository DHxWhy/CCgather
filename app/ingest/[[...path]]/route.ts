import { NextRequest, NextResponse } from "next/server";

const POSTHOG_HOST = "https://us.i.posthog.com";
const POSTHOG_ASSETS_HOST = "https://us-assets.i.posthog.com";

async function handler(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const search = request.nextUrl.search;

  // Determine target URL
  let targetUrl: string;
  if (pathname.startsWith("/ingest/static/")) {
    // Static assets
    const assetPath = pathname.replace("/ingest/static/", "/static/");
    targetUrl = `${POSTHOG_ASSETS_HOST}${assetPath}${search}`;
  } else {
    // API endpoints (flags, e, decide, etc.)
    const apiPath = pathname.replace("/ingest", "");
    targetUrl = `${POSTHOG_HOST}${apiPath}${search}`;
  }

  // Clone headers, remove host-specific ones
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    // Skip hop-by-hop headers and host
    if (!["host", "connection", "keep-alive", "transfer-encoding", "upgrade"].includes(lowerKey)) {
      headers.set(key, value);
    }
  });

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body:
        request.method !== "GET" && request.method !== "HEAD" ? await request.text() : undefined,
    });

    // Create response with same status and headers
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      // Skip hop-by-hop headers
      if (
        !["connection", "keep-alive", "transfer-encoding", "upgrade", "content-encoding"].includes(
          lowerKey
        )
      ) {
        responseHeaders.set(key, value);
      }
    });

    // Add CORS headers for client-side requests
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "Content-Type");

    const body = await response.arrayBuffer();
    return new NextResponse(body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[PostHog Proxy] Error:", error);
    return NextResponse.json({ error: "Proxy error" }, { status: 502 });
  }
}

// Handle all HTTP methods
export const GET = handler;
export const POST = handler;
export const OPTIONS = handler;

// Edge runtime for better performance
export const runtime = "edge";
