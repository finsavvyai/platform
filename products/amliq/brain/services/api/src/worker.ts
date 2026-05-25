import { createBrainHostApp, type BrainHostConfig } from "./runtime.js";
import type { AuditRecord, AuditSink } from "./types.js";
import {
  createWorkerAuthVerifier,
  workerRequiredRole,
} from "./worker-auth.js";

interface R2Bucket {
  put(key: string, value: string, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
}

export interface BrainWorkerEnv {
  readonly VERSION?: string;
  readonly BRAIN_AUTH_TOKEN?: string;
  readonly BRAIN_REQUIRED_ROLE?: string;
  readonly BRAIN_JWT_HS256_SECRET?: string;
  readonly BRAIN_JWT_ISSUER?: string;
  readonly BRAIN_JWT_AUDIENCE?: string;
  readonly BRAIN_SEARCH_ENDPOINT?: string;
  readonly BRAIN_SEARCH_AUTHORIZATION?: string;
  readonly BRAIN_SEARCH_TIMEOUT_MS?: string;
  readonly BRAIN_SEARCH_DEFAULT_TOP_K?: string;
  readonly BRAIN_SEARCH_MAX_TOP_K?: string;
  readonly BRAIN_SAR_DRAFT_ENDPOINT?: string;
  readonly BRAIN_SAR_DRAFT_AUTHORIZATION?: string;
  readonly BRAIN_SAR_DRAFT_TIMEOUT_MS?: string;
  readonly AUDIT_LOG_BUCKET?: R2Bucket;
}

export interface BrainWorkerDeps {
  readonly httpFetch?: typeof fetch;
  readonly clock?: () => Date;
  readonly auditFallbackSink?: AuditSink;
}

const auditKey = (record: AuditRecord): string => {
  const ts = record.ts.replace(/[:.]/g, "-");
  const safeEvent = record.event.replace(/[^a-zA-Z0-9_.-]/g, "_");
  return `brain-audit/${ts}-${safeEvent}.json`;
};

const auditSink = (env: BrainWorkerEnv): AuditSink => async (record) => {
  if (!env.AUDIT_LOG_BUCKET) return;
  await env.AUDIT_LOG_BUCKET.put(auditKey(record), JSON.stringify(record), {
    httpMetadata: { contentType: "application/json" },
  });
};

const timeoutMs = (raw: string | undefined): number | undefined => {
  if (raw === undefined || raw.trim().length === 0) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export const createBrainWorkerApp = (
  env: BrainWorkerEnv,
  deps: BrainWorkerDeps = {},
) => {
  const cfg: BrainHostConfig = {
    version: env.VERSION ?? "unknown",
    startedAtMs: Date.now(),
    auth: createWorkerAuthVerifier(env),
    audit: {
      sink: auditSink(env),
      ...(deps.auditFallbackSink !== undefined
        ? { fallbackSink: deps.auditFallbackSink }
        : {}),
    },
    requiredRole: workerRequiredRole(env),
    ...(deps.clock !== undefined ? { clock: deps.clock } : {}),
    ...(env.BRAIN_SEARCH_ENDPOINT
      ? {
          searchRuntime: {
            endpoint: env.BRAIN_SEARCH_ENDPOINT,
            ...(deps.httpFetch !== undefined ? { httpFetch: deps.httpFetch } : {}),
            ...(env.BRAIN_SEARCH_AUTHORIZATION
              ? { headers: { Authorization: env.BRAIN_SEARCH_AUTHORIZATION } }
              : {}),
            ...(timeoutMs(env.BRAIN_SEARCH_TIMEOUT_MS) !== undefined
              ? { timeoutMs: timeoutMs(env.BRAIN_SEARCH_TIMEOUT_MS)! }
              : {}),
            ...(timeoutMs(env.BRAIN_SEARCH_DEFAULT_TOP_K) !== undefined
              ? { defaultTopK: timeoutMs(env.BRAIN_SEARCH_DEFAULT_TOP_K)! }
              : {}),
            ...(timeoutMs(env.BRAIN_SEARCH_MAX_TOP_K) !== undefined
              ? { maxTopK: timeoutMs(env.BRAIN_SEARCH_MAX_TOP_K)! }
              : {}),
          },
        }
      : {}),
    ...(env.BRAIN_SAR_DRAFT_ENDPOINT
      ? {
          sarDraftRuntime: {
            endpoint: env.BRAIN_SAR_DRAFT_ENDPOINT,
            ...(deps.httpFetch !== undefined ? { httpFetch: deps.httpFetch } : {}),
            ...(env.BRAIN_SAR_DRAFT_AUTHORIZATION
              ? { headers: { Authorization: env.BRAIN_SAR_DRAFT_AUTHORIZATION } }
              : {}),
            ...(timeoutMs(env.BRAIN_SAR_DRAFT_TIMEOUT_MS) !== undefined
              ? { timeoutMs: timeoutMs(env.BRAIN_SAR_DRAFT_TIMEOUT_MS)! }
              : {}),
          },
        }
      : {}),
  };
  return createBrainHostApp(cfg);
};

export const createBrainWorkerFetch = (
  env: BrainWorkerEnv,
  deps: BrainWorkerDeps = {},
): ((request: Request) => Promise<Response>) => {
  const host = createBrainWorkerApp(env, deps);
  return (request) => Promise.resolve(host.app.fetch(request));
};

export default {
  async fetch(
    request: Request,
    env: BrainWorkerEnv,
  ): Promise<Response> {
    return createBrainWorkerFetch(env)(request);
  },
};
