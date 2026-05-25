// Edge Worker that fronts an sdlc-gateway origin and forwards tenant headers.
// Resolves X-Tenant-ID + X-Tenant-Tier from an Authorization bearer (your API
// key format) and proxies the request through. Cloudflare gives you free DDoS
// + WAF; sdlc-gateway behind it gives you stateful per-tenant rate limits.

export interface Env {
  ORIGIN_URL: string;
  TIER_BY_KEY?: KVNamespace;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const auth = req.headers.get("Authorization") || "";
    const apiKey = auth.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : "";

    if (!apiKey) {
      return jsonError(401, "MISSING_API_KEY", "Authorization: Bearer <key> required");
    }

    const { tenantID, tier } = await resolveTenant(apiKey, env);
    if (!tenantID) {
      return jsonError(401, "INVALID_API_KEY", "API key not recognized");
    }

    const origin = new URL(req.url);
    origin.protocol = "https:";
    origin.host = new URL(env.ORIGIN_URL).host;

    const upstream = new Request(origin.toString(), req);
    upstream.headers.set("X-Tenant-ID", tenantID);
    upstream.headers.set("X-Tenant-Tier", tier);
    upstream.headers.set("X-Forwarded-For", req.headers.get("CF-Connecting-IP") || "");

    return fetch(upstream);
  },
};

async function resolveTenant(
  apiKey: string,
  env: Env
): Promise<{ tenantID: string; tier: string }> {
  if (env.TIER_BY_KEY) {
    const value = await env.TIER_BY_KEY.get(apiKey, "json");
    if (value) {
      return value as { tenantID: string; tier: string };
    }
  }
  // Fallback: derive deterministic tenant from key hash. Replace this with
  // a real lookup against your user store in production.
  const tenantID = apiKey.slice(0, 16);
  return { tenantID, tier: "free" };
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(
    JSON.stringify({ error: { code, message } }),
    { status, headers: { "content-type": "application/json" } }
  );
}
