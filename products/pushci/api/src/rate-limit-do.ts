// Rate-limit Durable Object (I-002 fix).
//
// Cloudflare KV is eventually consistent (60s global lag), so a Bad Actor
// hitting different CF pop nodes can exceed the documented per-minute
// quota. Durable Objects give us a single strongly-consistent actor per
// partition key (here: IP + route-class), which eliminates that gap.
//
// Each DO instance keeps one in-memory counter with a 60s sliding window.
// The counter is *not* persisted — rate-limit state doesn't need to
// survive restarts; worst case the window resets early.
//
// License: Apache-2.0
//
// Wire-up:
//   wrangler.toml binding:  RATE_LIMITER (class: RateLimiterDO)
//   middleware entry:       `rateLimitMiddlewareDO` in ./middleware.ts
//
// Routes that use this DO must opt in per-route (see index.ts). Lighter
// routes continue on the KV-backed path for cost/latency reasons.
//
// Default window:     60_000ms
// Default bridge cap: 120 req/min
// Default general cap: 300 req/min

const WINDOW_MS = 60_000;

export interface RateLimitCheck {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // seconds until window reset (0 when allowed)
}

export interface IncrPayload {
  ip: string;
  limit: number;
}

// DurableObjectState is ambient (workers-types). Avoid `any` — type it.
interface DOState {
  storage: DurableObjectStorage;
}

interface DurableObjectStorage {
  // unused — state is in-memory only
  get<T>(k: string): Promise<T | undefined>;
}

export class RateLimiterDO {
  private state: DOState;
  private counters: Map<string, { count: number; resetAt: number }>;

  constructor(state: DOState) {
    this.state = state;
    this.counters = new Map();
  }

  async fetch(req: Request): Promise<Response> {
    if (req.method !== "POST") {
      return new Response("method not allowed", { status: 405 });
    }
    let body: IncrPayload;
    try {
      body = await req.json<IncrPayload>();
    } catch {
      return new Response(JSON.stringify({ error: "invalid json" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    if (!body.ip || typeof body.limit !== "number" || body.limit <= 0) {
      return new Response(JSON.stringify({ error: "ip and positive limit required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    const result = this.incrAndCheck(body.ip, body.limit);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  /** Strongly-consistent increment + check. Exported for tests. */
  incrAndCheck(ip: string, limit: number): RateLimitCheck {
    const now = Date.now();
    const existing = this.counters.get(ip);
    if (!existing || existing.resetAt <= now) {
      this.counters.set(ip, { count: 1, resetAt: now + WINDOW_MS });
      return { allowed: true, remaining: Math.max(0, limit - 1), retryAfter: 0 };
    }
    if (existing.count >= limit) {
      const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      return { allowed: false, remaining: 0, retryAfter };
    }
    existing.count += 1;
    this.counters.set(ip, existing);
    return {
      allowed: true,
      remaining: Math.max(0, limit - existing.count),
      retryAfter: 0,
    };
  }
}

/** Convenience helper invoked by the HTTP middleware. */
export async function checkRateLimit(
  stub: DurableObjectStub,
  ip: string,
  limit: number
): Promise<RateLimitCheck> {
  const res = await stub.fetch("https://rate-limiter.internal/incr", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ip, limit } satisfies IncrPayload),
  });
  if (!res.ok) {
    // Fail open on infra error — better to accept a burst than drop legitimate traffic.
    return { allowed: true, remaining: 0, retryAfter: 0 };
  }
  return (await res.json()) as RateLimitCheck;
}

interface DurableObjectStub {
  fetch(url: string, init?: RequestInit): Promise<Response>;
}
