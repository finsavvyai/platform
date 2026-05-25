import {
  Env, EMAIL_RE, ALLOWED_TIERS, cors, json,
  rateLimit, newToken, clientIP, baseURL,
} from "../_lib";

interface Body {
  email?: string;
  company?: string;
  tier?: string;
}

interface StoredEntry {
  email: string;
  company: string;
  tier: string;
  ip: string;
  ua: string;
  at: string;
  verified: boolean;
  verify_token?: string;
}

export const onRequestOptions: PagesFunction<Env> = ({ request }) =>
  new Response(null, { status: 204, headers: cors(request.headers.get("Origin")) });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get("Origin");
  const ip = clientIP(request);

  // 1. rate limit (per-IP token bucket backed by KV TTL)
  const rl = await rateLimit(env, ip);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "rate_limited", reset_at: rl.resetAt }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.max(1, rl.resetAt - Math.floor(Date.now() / 1000))),
        "X-RateLimit-Limit": String(rl.limit),
        "X-RateLimit-Remaining": String(rl.remaining),
        "X-RateLimit-Reset": String(rl.resetAt),
        ...cors(origin),
      },
    });
  }

  // 2. parse + validate
  let body: Body;
  try { body = (await request.json()) as Body; } catch { return json(400, { error: "invalid_json" }, origin); }

  const email = (body.email ?? "").trim().toLowerCase();
  const company = (body.company ?? "").trim().slice(0, 200);
  const tier = (body.tier ?? "starter").trim();

  if (!EMAIL_RE.test(email) || email.length > 254) return json(400, { error: "invalid_email" }, origin);
  if (!ALLOWED_TIERS.has(tier)) return json(400, { error: "invalid_tier" }, origin);

  // 3. dedup — if the email was already submitted, don't spam them with
  // a second verify email; return the existing record's status.
  if (env.WAITLIST_KV) {
    const existingRaw = await env.WAITLIST_KV.get(`email:${email}`);
    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw) as StoredEntry;
        return json(200, {
          ok: true,
          already_on_waitlist: true,
          verified: existing.verified,
          tier: existing.tier,
        }, origin);
      } catch { /* fall through to fresh write */ }
    }
  }

  // 4. create entry + verify token
  const token = newToken(16);
  const verifyURL = `${baseURL(request, env)}/api/waitlist/verify?token=${token}`;

  const entry: StoredEntry = {
    email,
    company,
    tier,
    ip,
    ua: request.headers.get("User-Agent") ?? "",
    at: new Date().toISOString(),
    verified: false,
    verify_token: token,
  };

  if (env.WAITLIST_KV) {
    try {
      await env.WAITLIST_KV.put(`email:${email}`, JSON.stringify(entry), {
        metadata: { tier, verified: false },
      });
      await env.WAITLIST_KV.put(`verify:${token}`, email, { expirationTtl: 60 * 60 * 24 * 7 });
    } catch (err) {
      console.error("kv put failed", err);
    }
  }

  // 5. optional webhook fan-out (e.g. forward to Resend / Mailgun / ReasoningBank)
  if (env.WAITLIST_WEBHOOK_URL) {
    try {
      await fetch(env.WAITLIST_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.WAITLIST_WEBHOOK_SECRET ? { "X-Webhook-Secret": env.WAITLIST_WEBHOOK_SECRET } : {}),
        },
        body: JSON.stringify({ ...entry, verify_url: verifyURL }),
      });
    } catch (err) {
      console.error("webhook forward failed", err);
    }
  }

  return new Response(JSON.stringify({ ok: true, verify_url: verifyURL, expires_in_days: 7 }), {
    status: 202,
    headers: {
      "Content-Type": "application/json",
      "X-RateLimit-Limit": String(rl.limit),
      "X-RateLimit-Remaining": String(rl.remaining),
      "X-RateLimit-Reset": String(rl.resetAt),
      ...cors(origin),
    },
  });
};
