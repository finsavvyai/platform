import type { Context, Next, MiddlewareHandler } from 'hono';

const DEFAULT_API_BASE = 'https://tokenforge-api.opensyber.cloud';

/** Options for the TokenForge API-backed middleware. */
export interface TokenForgeOptions {
  /** Your TokenForge API key (starts with `tf_`). */
  apiKey: string;
  /** API base URL (defaults to TokenForge cloud). */
  apiBase?: string;
  /** Paths to skip verification (e.g. ['/health', '/public/*']). */
  skipPaths?: string[];
  /** Paths that require elevated trust (>90). */
  sensitiveOps?: string[];
  /** Trust score threshold to allow (default: 80). */
  allowThreshold?: number;
  /** Trust score threshold for step-up (default: 40). */
  stepUpThreshold?: number;
}

interface EdgeVerifyResponse {
  data: {
    status: 'allow' | 'step_up' | 'block' | 'degraded';
    trustScore: number;
    deviceId: string | null;
    bound: boolean;
    reason?: string;
    userId?: string;
    sessionId?: string;
  };
}

/**
 * TokenForge Hono middleware — verifies device-bound sessions via the
 * TokenForge cloud API. All verification runs server-side on TokenForge
 * infrastructure.
 *
 * @param options - API key and optional configuration.
 * @returns Hono middleware handler.
 */
export function tokenForgeMiddleware(
  options: TokenForgeOptions,
): MiddlewareHandler {
  const apiBase = options.apiBase ?? DEFAULT_API_BASE;
  const allowThreshold = options.allowThreshold ?? 80;
  const stepUpThreshold = options.stepUpThreshold ?? 40;

  return async (c: Context, next: Next) => {
    if (shouldSkip(c.req.path, options.skipPaths)) return next();

    const headers = {
      signature: c.req.header('X-TF-Signature') ?? null,
      nonce: c.req.header('X-TF-Nonce') ?? null,
      timestamp: c.req.header('X-TF-Timestamp') ?? null,
      deviceId: c.req.header('X-TF-Device-ID') ?? null,
    };

    // Call TokenForge API for verification
    const res = await fetch(`${apiBase}/v1/edge/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: c.req.path,
        method: c.req.method,
        headers,
        ipAddress: c.req.header('cf-connecting-ip')
          ?? c.req.header('x-forwarded-for') ?? '',
        countryCode: c.req.header('cf-ipcountry') ?? '',
        userAgent: c.req.header('user-agent') ?? '',
      }),
    });

    if (!res.ok) {
      // API unreachable — degrade gracefully
      console.error('[TokenForge] API error:', res.status);
      c.set('tf', { bound: false, trustScore: 0, deviceId: null });
      return next();
    }

    const { data } = (await res.json()) as EdgeVerifyResponse;

    if (data.status === 'block') {
      return c.json({
        error: 'session_blocked',
        reason: data.reason,
        trustScore: data.trustScore,
      }, 401);
    }

    if (data.status === 'step_up') {
      if (isSensitiveOp(c.req.path, c.req.method, options.sensitiveOps)) {
        return c.json({
          error: 'elevated_trust_required',
          action: 'step_up_required',
          trustScore: data.trustScore,
        }, 403);
      }
      // Allow step-up range through for non-sensitive ops
    }

    if (
      isSensitiveOp(c.req.path, c.req.method, options.sensitiveOps)
      && data.trustScore < 90
    ) {
      return c.json({
        error: 'elevated_trust_required',
        action: 'step_up_required',
        trustScore: data.trustScore,
      }, 403);
    }

    c.set('tf', {
      bound: data.bound,
      trustScore: data.trustScore,
      deviceId: data.deviceId,
    });

    await next();
  };
}

/**
 * Per-route step-up gate. Use after `tokenForgeMiddleware` to require a
 * higher trust score on sensitive routes than the global allow threshold.
 *
 * ```ts
 * app.use(tokenForgeMiddleware({ apiKey }));
 * app.use('/admin/*', requireFreshSig({ minTrustScore: 90 }));
 * ```
 *
 * Responds with 403 `elevated_trust_required` when the cached `tf` context
 * is missing or below the threshold.
 */
export function requireFreshSig(opts: { minTrustScore?: number } = {}): MiddlewareHandler {
  const min = opts.minTrustScore ?? 90;
  return async (c: Context, next: Next) => {
    const tf = c.get('tf') as { trustScore?: number } | undefined;
    const score = tf?.trustScore ?? 0;
    if (score < min) {
      return c.json({
        error: 'elevated_trust_required',
        action: 'step_up_required',
        trustScore: score,
      }, 403);
    }
    await next();
  };
}

/** @internal */
export function shouldSkip(path: string, skipPaths?: string[]): boolean {
  if (!skipPaths) return false;
  return skipPaths.some((pattern) => {
    if (pattern.endsWith('*')) return path.startsWith(pattern.slice(0, -1));
    return path === pattern;
  });
}

/** @internal */
export function isSensitiveOp(
  path: string,
  method: string,
  sensitiveOps?: string[],
): boolean {
  if (!sensitiveOps) return false;
  const key = `${method} ${path}`;
  return sensitiveOps.some((op) => {
    if (op.includes('*')) {
      const parts = op.split(' ');
      const opMethod = parts[0];
      const opPath = parts[1];
      if (opMethod !== method || !opPath) return false;
      return new RegExp('^' + opPath.replace(/\*/g, '[^/]+') + '$').test(path);
    }
    return key === op;
  });
}
