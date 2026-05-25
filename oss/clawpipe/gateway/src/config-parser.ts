/** x-clawpipe-config request header parser.
 *
 * Accepts a JSON blob that overrides per-request pipeline behavior:
 *
 *   {
 *     "retry":  { "attempts": 3, "onStatus": [429, 502] },
 *     "cache":  { "mode": "simple" | "semantic" | "off", "ttl": 3600 },
 *     "strategy": "fallback" | "loadbalance" | "conditional" | "single",
 *     "targets": [ { "provider": "openai", "model": "gpt-4o", "weight": 0.7 } ],
 *     "guards": [ { "guard": "contains", "config": { "words": ["bomb"] } } ]
 *   }
 *
 * Invalid JSON => ParseError. Valid-JSON-but-wrong-shape => structural errors
 * enumerated. Fields are all optional.
 */

export type StrategyKind = 'fallback' | 'loadbalance' | 'conditional' | 'single';

export interface ConfigTarget {
  provider: string;
  model?: string;
  weight?: number;
  priority?: number;
}

export interface ParsedConfig {
  retry?: { attempts?: number; onStatus?: number[] };
  cache?: { mode?: 'simple' | 'semantic' | 'off'; ttl?: number };
  strategy?: StrategyKind;
  targets?: ConfigTarget[];
  guards?: Array<{ guard: string; config?: unknown; blockOnFail?: boolean }>;
}

export type ConfigParseResult =
  | { ok: true; config: ParsedConfig }
  | { ok: false; errors: string[] };

const MAX_CONFIG_BYTES = 8 * 1024;
const STRATEGY: readonly StrategyKind[] = ['fallback', 'loadbalance', 'conditional', 'single'];

export function parseConfigHeader(header: string | null): ConfigParseResult {
  if (!header) return { ok: true, config: {} };
  if (header.length > MAX_CONFIG_BYTES) return { ok: false, errors: [`config header > ${MAX_CONFIG_BYTES} bytes`] };

  let raw: unknown;
  try { raw = JSON.parse(header); }
  catch (e) { return { ok: false, errors: [`invalid JSON: ${(e as Error).message}`] }; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['config must be a JSON object'] };

  const r = raw as Record<string, unknown>;
  const errs: string[] = [];
  const out: ParsedConfig = {};

  if (r.strategy !== undefined) {
    if (typeof r.strategy !== 'string' || !STRATEGY.includes(r.strategy as StrategyKind)) {
      errs.push(`strategy must be one of ${STRATEGY.join('|')}`);
    } else out.strategy = r.strategy as StrategyKind;
  }

  if (r.retry !== undefined) {
    const rt = r.retry as Record<string, unknown>;
    if (typeof rt !== 'object' || rt === null) errs.push('retry must be object');
    else out.retry = {
      attempts: typeof rt.attempts === 'number' ? rt.attempts : undefined,
      onStatus: Array.isArray(rt.onStatus) ? rt.onStatus.filter((n) => typeof n === 'number') as number[] : undefined,
    };
  }

  if (r.cache !== undefined) {
    const c = r.cache as Record<string, unknown>;
    if (typeof c !== 'object' || c === null) errs.push('cache must be object');
    else out.cache = {
      mode: ['simple', 'semantic', 'off'].includes(c.mode as string) ? c.mode as 'simple' | 'semantic' | 'off' : undefined,
      ttl: typeof c.ttl === 'number' ? c.ttl : undefined,
    };
  }

  if (r.targets !== undefined) {
    if (!Array.isArray(r.targets)) errs.push('targets must be array');
    else out.targets = r.targets
      .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
      .filter((t) => typeof t.provider === 'string')
      .map((t) => ({
        provider: t.provider as string,
        model: typeof t.model === 'string' ? t.model : undefined,
        weight: typeof t.weight === 'number' ? t.weight : undefined,
        priority: typeof t.priority === 'number' ? t.priority : undefined,
      }));
  }

  if (r.guards !== undefined) {
    if (!Array.isArray(r.guards)) errs.push('guards must be array');
    else out.guards = r.guards
      .filter((g): g is Record<string, unknown> => !!g && typeof g === 'object')
      .filter((g) => typeof g.guard === 'string')
      .map((g) => ({
        guard: g.guard as string,
        config: g.config,
        blockOnFail: typeof g.blockOnFail === 'boolean' ? g.blockOnFail : undefined,
      }));
  }

  return errs.length ? { ok: false, errors: errs } : { ok: true, config: out };
}
