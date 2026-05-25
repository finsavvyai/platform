const DEFAULT_API_BASE = 'https://tokenforge-api.opensyber.cloud';

/** TokenForge context attached to event.locals.tf */
export interface TfContext {
  bound: boolean;
  trustScore: number;
  deviceId: string | null;
}

/** Options for the SvelteKit adapter. */
export interface TokenForgeSvelteKitOptions {
  /** Your TokenForge API key (starts with `tf_`). */
  apiKey: string;
  /** API base URL (defaults to TokenForge cloud). */
  apiBase?: string;
  /** Paths to skip verification. */
  skipPaths?: string[];
}

/** Minimal SvelteKit Handle event surface — avoids @sveltejs/kit dep. */
interface RequestEvent {
  request: Request;
  url: URL;
  locals: { tf?: TfContext };
  getClientAddress?: () => string;
}

type Handle = (input: {
  event: RequestEvent;
  resolve: (event: RequestEvent) => Promise<Response>;
}) => Promise<Response>;

/**
 * SvelteKit `handle` hook for TokenForge verification via the cloud API.
 *
 * Usage:
 * ```ts
 * // src/hooks.server.ts
 * import { tokenForgeHandle } from '@opensyber/tokenforge/sveltekit';
 * export const handle = tokenForgeHandle({ apiKey: process.env.TOKENFORGE_API_KEY! });
 * ```
 *
 * Reads `event.locals.tf` for downstream `+page.server.ts` / `+server.ts` use.
 */
export function tokenForgeHandle(options: TokenForgeSvelteKitOptions): Handle {
  const apiBase = options.apiBase ?? DEFAULT_API_BASE;

  return async ({ event, resolve }) => {
    const path = event.url.pathname;
    if (shouldSkip(path, options.skipPaths)) {
      event.locals.tf = { bound: false, trustScore: 0, deviceId: null };
      return resolve(event);
    }

    const header = (name: string): string | null =>
      event.request.headers.get(name);

    try {
      const apiRes = await fetch(`${apiBase}/v1/edge/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path,
          method: event.request.method,
          headers: {
            signature: header('x-tf-signature'),
            nonce: header('x-tf-nonce'),
            timestamp: header('x-tf-timestamp'),
            deviceId: header('x-tf-device-id'),
          },
          ipAddress:
            event.getClientAddress?.() ?? header('x-forwarded-for') ?? '',
          countryCode: header('cf-ipcountry') ?? '',
          userAgent: header('user-agent') ?? '',
        }),
      });

      if (!apiRes.ok) {
        event.locals.tf = { bound: false, trustScore: 0, deviceId: null };
        return resolve(event);
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

      event.locals.tf = {
        bound: data.bound,
        trustScore: data.trustScore,
        deviceId: data.deviceId,
      };
      return resolve(event);
    } catch {
      event.locals.tf = { bound: false, trustScore: 0, deviceId: null };
      return resolve(event);
    }
  };
}

/**
 * Per-route step-up gate. Call inside a `+page.server.ts` `load` or
 * `+server.ts` handler after `tokenForgeHandle` set `event.locals.tf`.
 *
 * Throws a 403 `Response` when below threshold; SvelteKit propagates it
 * up. Returns `void` on pass.
 */
export function requireFreshSig(
  event: { locals: { tf?: TfContext } },
  opts: { minTrustScore?: number } = {},
): void {
  const min = opts.minTrustScore ?? 90;
  const score = event.locals.tf?.trustScore ?? 0;
  if (score < min) {
    throw new Response(
      JSON.stringify({
        error: 'elevated_trust_required',
        action: 'step_up_required',
        trustScore: score,
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

function shouldSkip(path: string, skipPaths?: string[]): boolean {
  if (!skipPaths) return false;
  return skipPaths.some((p) =>
    p.endsWith('*') ? path.startsWith(p.slice(0, -1)) : path === p,
  );
}
