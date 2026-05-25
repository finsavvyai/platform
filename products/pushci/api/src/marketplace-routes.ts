// Marketplace action import — HTTP surface.
//
// POST /api/marketplace/resolve
//   body: { actionRef: string, inputs?: Record<string,string> }
//   returns: { action: ResolvedAction, yaml: string }
//
// The handler uses the KV `RUNNERS` namespace as a short-lived cache
// (1 hour) so repeated calls from the dashboard don't hammer
// raw.githubusercontent.com for the same `actions/setup-node@v4`
// lookup. Cache is keyed by normalized ref, not the raw string, so
// whitespace differences still hit.

import { Hono } from "hono";
import type { Env } from "./types";
import {
  parseActionRef,
  resolveAction,
  renderStageYaml,
  buildRawUrl,
  type ResolvedAction,
} from "./marketplace-action";
import { cacheKeyFor, canonicalRawUrl } from "./marketplace-action-validate";

interface ResolveBody {
  actionRef?: unknown;
  inputs?: unknown;
}

interface KvEnv extends Env {
  RUNNERS: KVNamespace;
}

const CACHE_PREFIX = "mkt:";
const CACHE_TTL_SECONDS = 60 * 60;

export const marketplaceRoutes = new Hono<{ Bindings: KvEnv }>();

marketplaceRoutes.post("/resolve", async (c) => {
  let body: ResolveBody;
  try {
    body = (await c.req.json()) as ResolveBody;
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  if (typeof body.actionRef !== "string" || !body.actionRef.trim()) {
    return c.json({ error: "actionRef required" }, 400);
  }
  const actionRef = body.actionRef.trim();
  const values = coerceInputs(body.inputs);

  const parsed = parseActionRef(actionRef);
  if (!parsed) {
    return c.json({
      error: "unrecognized_ref",
      hint: "use owner/repo@ref (e.g. actions/setup-node@v4); marketplace URLs aren't resolvable without hitting the GitHub API",
    }, 400);
  }

  // Cache key hashed from canonical URL — attacker-controlled raw input
  // never reaches KV. See marketplace-action-validate::cacheKeyFor (M-001).
  const canonical = canonicalRawUrl(buildRawUrl(parsed, "action.yml"));
  if (!canonical) {
    return c.json({ error: "unrecognized_ref", hint: "ref failed URL canonicalization" }, 400);
  }
  const cacheKey = `${CACHE_PREFIX}${await cacheKeyFor(canonical)}`;
  const cached = await readCache(c.env.RUNNERS, cacheKey);

  let resolved: ResolvedAction;
  try {
    resolved = cached ?? (await resolveAction(actionRef));
  } catch (e) {
    return c.json({ error: "resolve_failed", detail: String(e) }, 502);
  }
  if (!cached) {
    await writeCache(c.env.RUNNERS, cacheKey, resolved);
  }

  const yaml = renderStageYaml(resolved, values);
  return c.json({ action: resolved, yaml });
});

function coerceInputs(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string") out[k] = val;
  }
  return out;
}

async function readCache(
  kv: KVNamespace | undefined,
  key: string,
): Promise<ResolvedAction | null> {
  if (!kv) return null;
  try {
    const raw = await kv.get(key);
    return raw ? (JSON.parse(raw) as ResolvedAction) : null;
  } catch {
    return null;
  }
}

async function writeCache(
  kv: KVNamespace | undefined,
  key: string,
  value: ResolvedAction,
): Promise<void> {
  if (!kv) return;
  try {
    await kv.put(key, JSON.stringify(value), { expirationTtl: CACHE_TTL_SECONDS });
  } catch {
    /* cache write is best-effort */
  }
}
