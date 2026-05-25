/**
 * AMLIQ Brain — Hono app factory.
 *
 * Wires:
 *   GET  /health              → round-3 mesh contract shape (public)
 *   POST /v1/brain/ping       → authn + role-gated heartbeat that emits one
 *                                audit record; placeholder for future agent
 *                                endpoints (SAR Draft, Alert Triage, etc.)
 *
 * All wiring is via DI (BrainApiConfig). No transitive imports from other
 * @finsavvyai/* packages from this products/* subtree (round-2 rule).
 */

import { Hono } from "hono";
import { buildAuthMiddleware, getBrainAuth } from "./auth.js";
import { BrainAuditEmitter } from "./audit.js";
import { HealthBuilder } from "./health.js";
import { createRateLimitMiddleware } from "./rate-limit/index.js";
import { buildSearchHandler } from "./search/search-handler.js";
import type { BrainApiConfig } from "./types.js";

export interface BrainApp {
  readonly app: Hono;
  readonly audit: BrainAuditEmitter;
  readonly health: HealthBuilder;
}

export const createBrainApp = (config: BrainApiConfig): BrainApp => {
  const app = new Hono();

  const health = new HealthBuilder({
    version: config.version,
    startedAtMs: config.startedAtMs,
    ...(config.probes !== undefined ? { probes: config.probes } : {}),
  });

  const auditOpts = {
    sink: config.audit.sink,
    ...(config.audit.fallbackSink !== undefined
      ? { fallbackSink: config.audit.fallbackSink }
      : {}),
    ...(config.audit.chain !== undefined ? { chain: config.audit.chain } : {}),
    ...(config.clock !== undefined ? { clock: config.clock } : {}),
  };
  const audit = new BrainAuditEmitter(auditOpts);

  // -------- Pre-auth rate limit (mesh §10; off unless configured) --------
  if (config.rateLimit !== undefined) {
    const rl = config.rateLimit;
    app.use(
      "*",
      createRateLimitMiddleware({
        config: rl.config,
        store: rl.store,
        keyFn: rl.keyFn,
        ...(rl.failClosed !== undefined ? { failClosed: rl.failClosed } : {}),
        ...(rl.bypassPaths !== undefined
          ? { bypassPaths: rl.bypassPaths }
          : {}),
        ...(config.clock !== undefined
          ? { clock: () => config.clock!().getTime() }
          : {}),
        onReject: (info) => {
          // Fire-and-forget audit emit; stable code per mesh §10.
          void audit.emit({
            actorId: "anonymous",
            event: "brain.rate_limit.rejected",
            resource: `rate_limit:${info.key}`,
            decision: "deny",
            reason: info.decision.reason ?? "rate_limit.window_exceeded",
            meta: { path: info.path },
          });
        },
      }),
    );
  }

  // -------- Public: health --------
  app.get("/health", async (c) => {
    const snap = await health.snapshot();
    const status = snap.status === "down" ? 503 : 200;
    return c.json(snap, status);
  });

  // -------- Authenticated subtree --------
  const guarded = new Hono();
  const authMw = buildAuthMiddleware({
    verifier: config.auth,
    ...(config.requiredRole !== undefined
      ? { requiredRole: config.requiredRole }
      : {}),
  });
  guarded.use("*", authMw);

  guarded.post("/brain/ping", async (c) => {
    const { claims } = getBrainAuth(c);
    const result = await audit.emit({
      actorId: claims.sub,
      event: "brain.ping",
      resource: "brain:ping",
      decision: "allow",
      reason: "heartbeat",
    });
    if (!result.delivered && !result.fallbackUsed) {
      // Audit emit hard-failed (both primary and fallback). AMLIQ rule:
      // do not serve a successful response without an audited record.
      return c.json(
        { ok: false, error: "audit_emit_failed" },
        503,
      );
    }
    return c.json({ ok: true, ts: result.record.ts });
  });

  // -------- Search (append-only; mounted when configured) --------
  if (config.search !== undefined) {
    const searchHandler = buildSearchHandler({
      adapter: config.search.adapter,
      audit,
      ...(config.search.defaultTopK !== undefined
        ? { defaultTopK: config.search.defaultTopK }
        : {}),
      ...(config.search.maxTopK !== undefined
        ? { maxTopK: config.search.maxTopK }
        : {}),
    });
    guarded.post("/search", searchHandler);
  }

  app.route("/v1", guarded);

  return { app, audit, health };
};
