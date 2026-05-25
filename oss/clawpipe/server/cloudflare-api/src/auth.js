/** API key validation and rate limiting (KV-backed). */

export const TIER_LIMITS = {
  free: { rpm: 100, name: "Free" },
  pro: { rpm: 1000, name: "Pro" },
  unlimited: { rpm: 0, name: "Unlimited" },
};

export const FIXED_ROUTE_LIMITS = {
  login: { rpm: 12, name: "Login" },
  modelsPublic: { rpm: 60, name: "Public Models" },
  admin: { rpm: 30, name: "Admin" },
};

export async function validateApiKey(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const xApiKey = request.headers.get("X-API-Key") || "";

  let key = "";
  if (authHeader.startsWith("Bearer ")) {
    key = authHeader.slice(7).trim();
  } else if (xApiKey) {
    key = xApiKey.trim();
  }

  if (!key) {
    return {
      valid: false,
      error:
        "Missing API key. Use Authorization: Bearer <key> or X-API-Key header.",
    };
  }

  const keyData = await env.API_KEYS.get(key, { type: "json" });
  if (!keyData) {
    return { valid: false, error: "Invalid API key." };
  }
  if (keyData.active === false) {
    return { valid: false, error: "API key has been deactivated." };
  }

  return { valid: true, keyData, apiKey: key };
}

export function getClientIdentifier(request) {
  const cfIp = request.headers.get("CF-Connecting-IP");
  if (cfIp) return cfIp.trim();

  const forwarded = request.headers.get("X-Forwarded-For");
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIp = request.headers.get("X-Real-IP");
  if (realIp) return realIp.trim();

  return "anonymous";
}

function buildRateLimitKey(subject, bucket, minuteBucket) {
  if (bucket === "default") return `rl:${subject}:${minuteBucket}`;
  return `rl:${bucket}:${subject}:${minuteBucket}`;
}

async function checkLimit(subject, limit, env, bucket = "default") {
  if (limit === 0) return { allowed: true, limit: 0, remaining: 0 };

  const minuteBucket = Math.floor(Date.now() / 60000);
  const rlKey = buildRateLimitKey(subject, bucket, minuteBucket);
  const current = parseInt((await env.RATE_LIMIT.get(rlKey)) || "0", 10);

  if (current >= limit) {
    const retryAfter = 60 - (Math.floor(Date.now() / 1000) % 60);
    return { allowed: false, limit, remaining: 0, retryAfter };
  }

  await env.RATE_LIMIT.put(rlKey, String(current + 1), { expirationTtl: 120 });
  return { allowed: true, limit, remaining: limit - current - 1 };
}

export async function checkRateLimit(apiKey, tier, env, options = {}) {
  const limit = TIER_LIMITS[tier]?.rpm || 0;
  return checkLimit(apiKey, limit, env, options.bucket);
}

export async function checkFixedRateLimit(subject, limit, env, options = {}) {
  return checkLimit(subject, limit, env, options.bucket);
}
