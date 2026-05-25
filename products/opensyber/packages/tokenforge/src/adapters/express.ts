const DEFAULT_API_BASE = 'https://tokenforge-api.opensyber.cloud';

/** Express request (minimal interface). */
interface ExpressRequest {
  path: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  tf?: TfContext;
  [key: string]: unknown;
}

interface ExpressResponse {
  status(code: number): ExpressResponse;
  json(body: unknown): void;
}

/** TokenForge context attached to req.tf */
export interface TfContext {
  bound: boolean;
  trustScore: number;
  deviceId: string | null;
}

type NextFunction = (err?: unknown) => void;

/** Options for the Express middleware. */
export interface TokenForgeExpressOptions {
  /** Your TokenForge API key (starts with `tf_`). */
  apiKey: string;
  /** API base URL (defaults to TokenForge cloud). */
  apiBase?: string;
  /** Paths to skip verification. */
  skipPaths?: string[];
  /** Paths requiring elevated trust (>90). */
  sensitiveOps?: string[];
}

/**
 * Express middleware for TokenForge verification via the cloud API.
 *
 * Usage:
 * ```ts
 * import { tokenForgeMiddleware } from '@opensyber/tokenforge/express';
 * app.use(tokenForgeMiddleware({ apiKey: process.env.TOKENFORGE_API_KEY! }));
 * ```
 *
 * After middleware runs, `req.tf` contains:
 * - `bound: boolean` — whether device is bound
 * - `trustScore: number` — current trust score
 * - `deviceId: string | null` — device identifier
 */
export function tokenForgeMiddleware(options: TokenForgeExpressOptions) {
  const apiBase = options.apiBase ?? DEFAULT_API_BASE;

  return async (req: ExpressRequest, res: ExpressResponse, next: NextFunction): Promise<void> => {
    if (shouldSkip(req.path, options.skipPaths)) {
      req.tf = { bound: false, trustScore: 0, deviceId: null };
      next();
      return;
    }

    const header = (name: string): string | null => {
      const val = req.headers[name.toLowerCase()];
      return typeof val === 'string' ? val : null;
    };

    try {
      const apiRes = await fetch(`${apiBase}/v1/edge/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: req.path,
          method: req.method,
          headers: {
            signature: header('x-tf-signature'),
            nonce: header('x-tf-nonce'),
            timestamp: header('x-tf-timestamp'),
            deviceId: header('x-tf-device-id'),
          },
          ipAddress: req.ip ?? header('x-forwarded-for') ?? '',
          countryCode: header('cf-ipcountry') ?? '',
          userAgent: header('user-agent') ?? '',
        }),
      });

      if (!apiRes.ok) {
        req.tf = { bound: false, trustScore: 0, deviceId: null };
        next();
        return;
      }

      const { data } = (await apiRes.json()) as {
        data: { status: string; trustScore: number; deviceId: string | null; bound: boolean; reason?: string };
      };

      if (data.status === 'block') {
        res.status(401).json({ error: 'session_blocked', reason: data.reason });
        return;
      }

      req.tf = { bound: data.bound, trustScore: data.trustScore, deviceId: data.deviceId };
      next();
    } catch {
      req.tf = { bound: false, trustScore: 0, deviceId: null };
      next();
    }
  };
}

function shouldSkip(path: string, skipPaths?: string[]): boolean {
  if (!skipPaths) return false;
  return skipPaths.some((p) => p.endsWith('*') ? path.startsWith(p.slice(0, -1)) : path === p);
}

/**
 * Per-route step-up gate. Use after `tokenForgeMiddleware` ran globally,
 * mounted on the routes that need elevated trust.
 *
 * ```ts
 * app.use(tokenForgeMiddleware({ apiKey }));
 * app.use('/admin', requireFreshSig({ minTrustScore: 90 }));
 * ```
 *
 * Responds 403 `elevated_trust_required` when `req.tf` is missing or
 * `trustScore` is below the threshold.
 */
export function requireFreshSig(opts: { minTrustScore?: number } = {}) {
  const min = opts.minTrustScore ?? 90;
  return (req: ExpressRequest, res: ExpressResponse, next: NextFunction): void => {
    const score = req.tf?.trustScore ?? 0;
    if (score < min) {
      res.status(403).json({
        error: 'elevated_trust_required',
        action: 'step_up_required',
        trustScore: score,
      });
      return;
    }
    next();
  };
}
