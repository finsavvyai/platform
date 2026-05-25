const DEFAULT_API_BASE = 'https://tokenforge-api.opensyber.cloud';

/** TokenForge context attached to request.tf */
export interface TfContext {
  bound: boolean;
  trustScore: number;
  deviceId: string | null;
}

/** Options for the Fastify plugin. */
export interface TokenForgeFastifyOptions {
  /** Your TokenForge API key (starts with `tf_`). */
  apiKey: string;
  /** API base URL (defaults to TokenForge cloud). */
  apiBase?: string;
  /** Paths to skip verification. */
  skipPaths?: string[];
}

interface FastifyRequest {
  url: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  tf?: TfContext;
}

interface FastifyReply {
  code(statusCode: number): FastifyReply;
  send(payload: unknown): void;
}

interface FastifyInstance {
  addHook(
    name: 'preHandler',
    handler: (req: FastifyRequest, reply: FastifyReply) => Promise<void>,
  ): void;
  decorateRequest(name: string, value: unknown): void;
}

/**
 * Fastify plugin for TokenForge verification via the cloud API.
 *
 * Usage:
 * ```ts
 * import { tokenForgePlugin } from '@opensyber/tokenforge/fastify';
 * fastify.register(tokenForgePlugin, {
 *   apiKey: process.env.TOKENFORGE_API_KEY!,
 * });
 * ```
 */
export function tokenForgePlugin(
  fastify: FastifyInstance,
  options: TokenForgeFastifyOptions,
  done: (err?: Error) => void,
): void {
  const apiBase = options.apiBase ?? DEFAULT_API_BASE;

  fastify.decorateRequest('tf', null);

  fastify.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    const path = req.url.split('?')[0] ?? req.url;

    if (shouldSkip(path, options.skipPaths)) {
      req.tf = { bound: false, trustScore: 0, deviceId: null };
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
          path,
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
        return;
      }

      const { data } = (await apiRes.json()) as {
        data: { status: string; trustScore: number; deviceId: string | null; bound: boolean; reason?: string };
      };

      if (data.status === 'block') {
        reply.code(401).send({ error: 'session_blocked', reason: data.reason });
        return;
      }

      req.tf = { bound: data.bound, trustScore: data.trustScore, deviceId: data.deviceId };
    } catch {
      req.tf = { bound: false, trustScore: 0, deviceId: null };
    }
  });

  done();
}

function shouldSkip(path: string, skipPaths?: string[]): boolean {
  if (!skipPaths) return false;
  return skipPaths.some((p) => p.endsWith('*') ? path.startsWith(p.slice(0, -1)) : path === p);
}

/**
 * Per-route step-up gate. Register after `tokenForgePlugin` ran globally,
 * scoped to a route that needs elevated trust.
 *
 * ```ts
 * fastify.register(tokenForgePlugin, { apiKey });
 * fastify.addHook('preHandler', async (req, reply) => {
 *   if (req.url.startsWith('/admin')) await requireFreshSig()(req, reply);
 * });
 * ```
 *
 * Responds 403 `elevated_trust_required` when `request.tf` is missing or
 * `trustScore` is below the threshold.
 */
export function requireFreshSig(opts: { minTrustScore?: number } = {}) {
  const min = opts.minTrustScore ?? 90;
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const score = req.tf?.trustScore ?? 0;
    if (score < min) {
      reply.code(403).send({
        error: 'elevated_trust_required',
        action: 'step_up_required',
        trustScore: score,
      });
    }
  };
}
