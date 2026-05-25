const DEFAULT_API_BASE = 'https://tokenforge-api.opensyber.cloud';

type NextRequest = Request & { nextUrl?: { pathname: string } };

/** TokenForge context passed to wrapped handlers. */
export interface TfContext {
  bound: boolean;
  trustScore: number;
  deviceId: string | null;
}

/** Options for the Next.js adapter. */
export interface TokenForgeNextOptions {
  /** Your TokenForge API key (starts with `tf_`). */
  apiKey: string;
  /** API base URL (defaults to TokenForge cloud). */
  apiBase?: string;
  /** Paths to skip verification. */
  skipPaths?: string[];
}

/**
 * Next.js App Router — wrap an API route handler with TokenForge verification.
 *
 * Usage:
 * ```ts
 * import { withTokenForge } from '@opensyber/tokenforge/nextjs';
 *
 * async function handler(req: Request, tf: TfContext) {
 *   return Response.json({ bound: tf.bound, score: tf.trustScore });
 * }
 * export const GET = withTokenForge(handler, {
 *   apiKey: process.env.TOKENFORGE_API_KEY!,
 * });
 * ```
 */
export function withTokenForge(
  handler: (req: NextRequest, tf: TfContext) => Promise<Response>,
  options: TokenForgeNextOptions,
) {
  const apiBase = options.apiBase ?? DEFAULT_API_BASE;

  return async (req: NextRequest): Promise<Response> => {
    const url = new URL(req.url);
    if (shouldSkip(url.pathname, options.skipPaths)) {
      return handler(req, { bound: false, trustScore: 0, deviceId: null });
    }
    const header = (name: string): string | null => req.headers.get(name);

    try {
      const apiRes = await fetch(`${apiBase}/v1/edge/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: url.pathname, method: req.method,
          headers: {
            signature: header('x-tf-signature'), nonce: header('x-tf-nonce'),
            timestamp: header('x-tf-timestamp'), deviceId: header('x-tf-device-id'),
          },
          ipAddress: header('x-forwarded-for') ?? '',
          countryCode: header('cf-ipcountry') ?? '',
          userAgent: header('user-agent') ?? '',
        }),
      });
      if (!apiRes.ok) return handler(req, { bound: false, trustScore: 0, deviceId: null });
      const { data } = (await apiRes.json()) as {
        data: { status: string; trustScore: number; deviceId: string | null; bound: boolean; reason?: string };
      };
      if (data.status === 'block') {
        return new Response(
          JSON.stringify({ error: 'session_blocked', reason: data.reason }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return handler(req, { bound: data.bound, trustScore: data.trustScore, deviceId: data.deviceId });
    } catch {
      return handler(req, { bound: false, trustScore: 0, deviceId: null });
    }
  };
}

/**
 * Next.js Middleware compatible function.
 * Use in middleware.ts for edge verification.
 *
 * Returns proceed=true with TfContext, or proceed=false with a Response.
 */
export async function tokenForgeCheck(
  req: NextRequest,
  options: TokenForgeNextOptions,
): Promise<{ proceed: true; tf: TfContext } | { proceed: false; response: Response }> {
  const apiBase = options.apiBase ?? DEFAULT_API_BASE;
  const url = new URL(req.url);
  if (shouldSkip(url.pathname, options.skipPaths)) {
    return { proceed: true, tf: { bound: false, trustScore: 0, deviceId: null } };
  }
  const header = (name: string): string | null => req.headers.get(name);

  const apiRes = await fetch(`${apiBase}/v1/edge/verify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: url.pathname,
      method: req.method,
      headers: {
        signature: header('x-tf-signature'),
        nonce: header('x-tf-nonce'),
        timestamp: header('x-tf-timestamp'),
        deviceId: header('x-tf-device-id'),
      },
      ipAddress: header('x-forwarded-for') ?? '',
      countryCode: header('cf-ipcountry') ?? '',
      userAgent: header('user-agent') ?? '',
    }),
  });

  if (!apiRes.ok) {
    return { proceed: true, tf: { bound: false, trustScore: 0, deviceId: null } };
  }

  const { data } = (await apiRes.json()) as {
    data: { status: string; trustScore: number; deviceId: string | null; bound: boolean; reason?: string };
  };

  if (data.status === 'block') {
    return {
      proceed: false,
      response: new Response(
        JSON.stringify({ error: 'session_blocked', reason: data.reason }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    };
  }

  return {
    proceed: true,
    tf: { bound: data.bound, trustScore: data.trustScore, deviceId: data.deviceId },
  };
}

/**
 * Per-route step-up gate. Wrap an inner handler that already received a
 * `TfContext` (typically via `withTokenForge`). Returns 403 with
 * `elevated_trust_required` when the device's `trustScore` is below the
 * threshold (default 90).
 *
 * ```ts
 * export const POST = withTokenForge(
 *   withFreshSig(adminHandler, { minTrustScore: 90 }),
 *   { apiKey: process.env.TOKENFORGE_API_KEY! },
 * );
 * ```
 */
export function withFreshSig(
  handler: (req: NextRequest, tf: TfContext) => Promise<Response>,
  opts: { minTrustScore?: number } = {},
): (req: NextRequest, tf: TfContext) => Promise<Response> {
  const min = opts.minTrustScore ?? 90;
  return async (req, tf) => {
    if (!tf || tf.trustScore < min) {
      return new Response(
        JSON.stringify({
          error: 'elevated_trust_required',
          action: 'step_up_required',
          trustScore: tf?.trustScore ?? 0,
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return handler(req, tf);
  };
}

/**
 * Cross-adapter alias for {@link withFreshSig}. The 5 non-Next.js adapters
 * (astro / express / fastify / hono / sveltekit) all export `requireFreshSig`;
 * exposing the same name here keeps the per-adapter docs uniform so the
 * Sprint 39 step-up snippet doesn't fork by framework.
 */
export const requireFreshSig = withFreshSig;

function shouldSkip(path: string, skipPaths?: string[]): boolean {
  return skipPaths?.some((p) => p.endsWith('*') ? path.startsWith(p.slice(0, -1)) : path === p) ?? false;
}
