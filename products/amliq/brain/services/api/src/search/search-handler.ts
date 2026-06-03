/**
 * POST /v1/search handler factory.
 *
 * Wires:
 *   - auth middleware (consumed from server.ts — assumed present in front)
 *   - request validation (q + tenant_id required; top_k optional, bounded)
 *   - SearchAdapter call (DI; talks to oss/finsavvy-rag at runtime)
 *   - citation linker (pure)
 *   - audit emit (event=brain.search.query; decision=served|forbidden|error)
 *
 * AMLIQ rule: audit emit hard-fail (primary + fallback) → 503. Tenant scope
 * enforcement is the critical-path branch covered at 100%.
 *
 * No PII in the audit reason — only stable codes. Query text NEVER reaches
 * the audit record (it could contain analyst-typed PII).
 *
 * 200-line cap.
 */
import type { Context, Handler } from "hono";
import type { BrainAuditEmitter } from "../audit.js";
import { getBrainAuth } from "../auth.js";
import { linkCitations } from "./citation-linker.js";
import { parseSearchRequest } from "./request-schema.js";
import type {
  SearchAdapter,
  SearchErrorCode,
  SearchResponse,
} from "./types.js";

export interface SearchHandlerOptions {
  readonly adapter: SearchAdapter;
  readonly audit: BrainAuditEmitter;
  readonly clock?: () => number;
  readonly defaultTopK?: number;
  readonly maxTopK?: number;
}

const DEFAULT_TOP_K = 10;
const MAX_TOP_K = 50;

const denyJson = (
  c: Context,
  code: SearchErrorCode,
  status: 400 | 403 | 503,
): Response => c.json({ ok: false, error: code }, status);

const parseBody = async (
  c: Context,
): Promise<ReturnType<typeof parseSearchRequest>> => {
  try {
    const j = await c.req.json();
    return parseSearchRequest(j);
  } catch {
    return null;
  }
};

const clampTopK = (
  raw: unknown,
  fallback: number,
  max: number,
): number => {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
  const n = Math.floor(raw);
  if (n < 1) return 1;
  if (n > max) return max;
  return n;
};

const auditOrFail = async (
  audit: BrainAuditEmitter,
  actorId: string,
  tenantId: string,
  decision: "allow" | "deny" | "error",
  reason: string,
): Promise<boolean> => {
  const r = await audit.emit({
    actorId,
    event: "brain.search.query",
    resource: `brain:search:${tenantId}`,
    decision,
    reason,
  });
  return r.delivered || r.fallbackUsed;
};

export const buildSearchHandler = (
  opts: SearchHandlerOptions,
): Handler => {
  const defaultTopK = opts.defaultTopK ?? DEFAULT_TOP_K;
  const maxTopK = opts.maxTopK ?? MAX_TOP_K;
  const now = opts.clock ?? (() => Date.now());

  return async (c: Context): Promise<Response> => {
    const { claims } = getBrainAuth(c);
    const actorId = claims.sub;
    const body = await parseBody(c);
    const q = typeof body?.q === "string" ? body.q.trim() : "";
    const tenantId =
      typeof body?.tenant_id === "string" ? body.tenant_id.trim() : "";

    if (tenantId.length === 0) {
      const audited = await auditOrFail(
        opts.audit,
        actorId,
        "unknown",
        "deny",
        "missing_tenant",
      );
      if (!audited) return denyJson(c, "audit_emit_failed", 503);
      return denyJson(c, "missing_tenant", 403);
    }

    if (q.length === 0) {
      const audited = await auditOrFail(
        opts.audit,
        actorId,
        tenantId,
        "deny",
        "missing_query",
      );
      if (!audited) return denyJson(c, "audit_emit_failed", 503);
      return denyJson(c, "missing_query", 400);
    }

    const topK = clampTopK(body?.top_k, defaultTopK, maxTopK);

    const startedAt = now();
    let adapterRes;
    try {
      adapterRes = await opts.adapter.query({
        text: q,
        tenantId, // tenant scope MUST be passed to the adapter
        topK,
      });
    } catch {
      const audited = await auditOrFail(
        opts.audit,
        actorId,
        tenantId,
        "error",
        "adapter_error",
      );
      if (!audited) return denyJson(c, "audit_emit_failed", 503);
      return denyJson(c, "adapter_error", 503);
    }

    const results = linkCitations(q, adapterRes.hits);
    const audited = await auditOrFail(
      opts.audit,
      actorId,
      tenantId,
      "allow",
      "served",
    );
    if (!audited) return denyJson(c, "audit_emit_failed", 503);

    const latencyMs = now() - startedAt;
    const resp: SearchResponse = {
      ok: true,
      query: q,
      results,
      latencyMs:
        adapterRes.latencyMs > 0 ? adapterRes.latencyMs : latencyMs,
    };
    return c.json(resp, 200);
  };
};
