/**
 * Hono HTTP server for the Investigate Decision API.
 *
 * Routes:
 *   POST /v1/aml/decision  — auth + tenant + audit required
 *   GET  /health           — mesh §1 shape (status/checks/uptime_s/version)
 *
 * All DI is constructor-style: createApp({ ... }). No env access here —
 * `index.ts` composes env into deps at boot.
 *
 * Per AMLIQ CLAUDE.md:
 *   - 401 on invalid/absent JWT
 *   - 403 on missing/unknown tenant
 *   - 503 on audit emit failure (release-blocking)
 *   - Engine-all-fail does NOT 500 — caller gets an AmlDecision with errors
 */

import { Hono } from "hono";
import { AuditEmitFailure, type DecisionService } from "./decision-service.js";
import type { DecisionContext, DecisionRequest, Subject, Transaction } from "./types.js";

export interface AuthClaims {
  readonly sub: string;
  readonly tenant_id?: string;
  readonly roles?: readonly string[];
}

export interface CreateAppDeps {
  readonly service: DecisionService;
  readonly verifyJwt: (token: string) => Promise<AuthClaims | null>;
  readonly version: string;
  readonly bootTime?: number;
  readonly engineHealth?: () => Promise<
    Readonly<Record<string, "ok" | "degraded" | "down">>
  >;
  /** Required role for /v1/aml/decision. Default: "aml:decision:write". */
  readonly requiredRole?: string;
}

const REQUIRED_ROLE_DEFAULT = "aml:decision:write";

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null;

const parseRequest = (raw: unknown): DecisionRequest | null => {
  if (!isRecord(raw)) return null;
  const { subject, transaction, tenant_id, context } = raw;
  if (!isRecord(subject) || !isRecord(transaction)) return null;
  if (typeof tenant_id !== "string" || tenant_id.length === 0) return null;
  // Minimal structural validation. Engines re-validate per their own schema.
  const s = subject as unknown as Subject;
  const t = transaction as unknown as Transaction;
  if (typeof s.subject_hash !== "string") return null;
  if (typeof t.transaction_id !== "string") return null;
  if (
    typeof t.amount_minor !== "number" ||
    !Number.isInteger(t.amount_minor)
  )
    return null;
  return {
    subject: s,
    transaction: t,
    tenant_id,
    ...(isRecord(context) ? { context: context as DecisionContext } : {}),
  };
};

const extractBearer = (header: string | undefined): string | null => {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
};

export const createApp = (deps: CreateAppDeps) => {
  const app = new Hono();
  const bootTime = deps.bootTime ?? Date.now();
  const requiredRole = deps.requiredRole ?? REQUIRED_ROLE_DEFAULT;

  app.get("/health", async (c) => {
    const checks = deps.engineHealth ? await deps.engineHealth() : {};
    const statuses = Object.values(checks);
    const anyDown = statuses.includes("down");
    const anyDegraded = statuses.includes("degraded");
    const status: "ok" | "degraded" | "down" = anyDown
      ? "down"
      : anyDegraded
        ? "degraded"
        : "ok";
    return c.json({
      status,
      version: deps.version,
      uptime_s: Math.floor((Date.now() - bootTime) / 1000),
      checks: Object.entries(checks).map(([name, st]) => ({ name, status: st })),
    });
  });

  app.post("/v1/aml/decision", async (c) => {
    const token = extractBearer(c.req.header("authorization"));
    if (!token) return c.json({ error: "unauthorized" }, 401);
    const claims = await deps.verifyJwt(token);
    if (!claims) return c.json({ error: "unauthorized" }, 401);
    if (!(claims.roles ?? []).includes(requiredRole)) {
      return c.json({ error: "forbidden" }, 403);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "bad_request" }, 400);
    }
    const parsed = parseRequest(body);
    if (!parsed) return c.json({ error: "bad_request" }, 400);

    // Tenant gate: JWT must carry tenant_id, and it MUST match the body's.
    if (!claims.tenant_id || claims.tenant_id !== parsed.tenant_id) {
      return c.json({ error: "forbidden" }, 403);
    }

    try {
      const decision = await deps.service.handle(parsed);
      return c.json(decision, 200);
    } catch (err) {
      if (err instanceof AuditEmitFailure) {
        return c.json({ error: "audit_unavailable" }, 503);
      }
      // Defensive — orchestrator + clients are designed not to throw.
      return c.json({ error: "internal" }, 500);
    }
  });

  return app;
};

export type App = ReturnType<typeof createApp>;
