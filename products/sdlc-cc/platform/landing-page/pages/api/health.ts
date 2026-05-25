import type { NextRequest } from "next/server";

export const config = {
  runtime: "edge",
};

export default async function handler(req: NextRequest) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const body = JSON.stringify({
      status: "healthy",
      timestamp: new Date().toISOString(),
      message: "SDLC Platform API is working",
    });

    return new Response(req.method === "HEAD" ? null : body, {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=30, s-maxage=30",
      },
    });
  } catch (error) {
    console.error("Health check error:", error);
    return new Response(
      JSON.stringify({
        status: "error",
        timestamp: new Date().toISOString(),
        error: "Internal server error",
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
}
