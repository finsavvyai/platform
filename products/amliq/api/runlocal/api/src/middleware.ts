import type { Context, Next } from "hono";
import type { Env } from "./types";

type MwEnv = Env & { RUNNERS: KVNamespace };

const ALLOWED_ORIGINS = [
  "https://pushci.dev",
  "https://pushci-app.pages.dev",
  "http://localhost:5173",
  "http://localhost:3000",
];

export async function corsMiddleware(c: Context<{ Bindings: MwEnv }>, next: Next) {
  const origin = c.req.header("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : "";

  if (c.req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Authorization,Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  await next();
  if (allowed) c.res.headers.set("Access-Control-Allow-Origin", allowed);
}

export async function rateLimitMiddleware(c: Context<{ Bindings: MwEnv }>, next: Next) {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const key = `rl:${ip}:${Math.floor(Date.now() / 60000)}`;

  const current = await c.env.RUNNERS.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= 120) {
    return c.json(
      { error: "rate limit exceeded" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  await c.env.RUNNERS.put(key, String(count + 1), { expirationTtl: 120 });
  await next();
}

export async function requestLogger(c: Context<{ Bindings: MwEnv }>, next: Next) {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;
  const ip = c.req.header("cf-connecting-ip") ?? "-";

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      method,
      path,
      status,
      duration_ms: duration,
      ip,
    })
  );
}

export async function errorHandler(c: Context<{ Bindings: MwEnv }>, next: Next) {
  try {
    await next();
  } catch (err) {
    const id = crypto.randomUUID().slice(0, 8);
    const msg = err instanceof Error ? err.message : "unknown";
    console.error(JSON.stringify({ error_id: id, message: msg, stack: String(err) }));
    return c.json({ error: "internal error", error_id: id }, 500);
  }
}
