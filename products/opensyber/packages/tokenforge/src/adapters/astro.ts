const DEFAULT_API_BASE = 'https://tokenforge-api.opensyber.cloud';

/** TokenForge context attached to context.locals.tf */
export interface TfContext {
  bound: boolean;
  trustScore: number;
  deviceId: string | null;
}

/** Options for the Astro middleware. */
export interface TokenForgeAstroOptions {
  /** Your TokenForge API key (starts with `tf_`). */
  apiKey: string;
  /** API base URL (defaults to TokenForge cloud). */
  apiBase?: string;
  /** Paths to skip verification. */
  skipPaths?: string[];
}

/** Minimal Astro middleware context — avoids astro:middleware dep. */
interface APIContext {
  request: Request;
  url: URL;
  locals: { tf?: TfContext };
  clientAddress?: string;
}

type MiddlewareNext = () => Promise<Response>;
type MiddlewareHandler = (
  context: APIContext,
  next: MiddlewareNext,
) => Promise<Response>;

/**
 * Astro middleware for TokenForge verification via the cloud API.
 *
 * Usage:
 * ```ts
 * // src/middleware.ts
 * import { tokenForgeMiddleware } from '@opensyber/tokenforge/astro';
 * export const onRequest = tokenForgeMiddleware({
 *   apiKey: import.meta.env.TOKENFORGE_API_KEY,
 * });
 * ```
 *
 * Reads `Astro.locals.tf` for downstream pages and endpoints.
 */
export function tokenForgeMiddleware(
  options: TokenForgeAstroOptions,
): MiddlewareHandler {
  const apiBase = options.apiBase ?? DEFAULT_API_BASE;

  return async (context, next) => {
    const path = context.url.pathname;
    if (shouldSkip(path, options.skipPaths)) {
      context.locals.tf = { bound: false, trustScore: 0, deviceId: null };
      return next();
    }

    const header = (name: string): string | null =>
      context.request.headers.get(name);

    try {
      const apiRes = await fetch(`${apiBase}/v1/edge/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path,
          method: context.request.method,
          headers: {
            signature: header('x-tf-signature'),
            nonce: header('x-tf-nonce'),
            timestamp: header('x-tf-timestamp'),
            deviceId: header('x-tf-device-id'),
          },
          ipAddress: context.clientAddress ?? header('x-forwarded-for') ?? '',
          countryCode: header('cf-ipcountry') ?? '',
          userAgent: header('user-agent') ?? '',
        }),
      });

      if (!apiRes.ok) {
        context.locals.tf = { bound: false, trustScore: 0, deviceId: null };
        return next();
      }

      const { data } = (await apiRes.json()) as {
        data: {
          status: string;
          trustScore: number;
          deviceId: string | null;
          bound: boolean;
          reason?: string;
        };
      };

      if (data.status === 'block') {
        return new Response(
          JSON.stringify({ error: 'session_blocked', reason: data.reason }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        );
      }

      context.locals.tf = {
        bound: data.bound,
        trustScore: data.trustScore,
        deviceId: data.deviceId,
      };
      return next();
    } catch {
      context.locals.tf = { bound: false, trustScore: 0, deviceId: null };
      return next();
    }
  };
}

/**
 * Per-route step-up gate. Use inside page or endpoint code after the
 * middleware has populated `Astro.locals.tf`.
 *
 * Returns a 403 `Response` when below threshold; the caller should
 * `return` it. Returns `null` on pass.
 */
export function requireFreshSig(
  locals: { tf?: TfContext },
  opts: { minTrustScore?: number } = {},
): Response | null {
  const min = opts.minTrustScore ?? 90;
  const score = locals.tf?.trustScore ?? 0;
  if (score < min) {
    return new Response(
      JSON.stringify({
        error: 'elevated_trust_required',
        action: 'step_up_required',
        trustScore: score,
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }
  return null;
}

function shouldSkip(path: string, skipPaths?: string[]): boolean {
  if (!skipPaths) return false;
  return skipPaths.some((p) =>
    p.endsWith('*') ? path.startsWith(p.slice(0, -1)) : path === p,
  );
}
