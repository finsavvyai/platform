/**
 * Test-only helpers for the search-handler specs. Kept out of build
 * outputs (test files only import this; vitest config + tsconfig exclude
 * *.test-helpers.ts).
 */
import type {
  AuthVerifier,
  BrainApiConfig,
} from "../types.js";
import type {
  SearchAdapter,
  SearchAdapterQuery,
} from "./types.js";
import type { ComplianceDoc } from "../../../retrieval/src/types.js";

export const okVerifier: AuthVerifier = {
  verify: async () => ({
    ok: true,
    claims: {
      sub: "alice",
      iss: "iss",
      aud: "amliq-brain",
      exp: Math.floor(Date.now() / 1000) + 3600,
      roles: ["aml:decision:write"],
    },
  }),
};

export const doc = (
  overrides: Partial<ComplianceDoc> = {},
): ComplianceDoc => ({
  source: "fincen_rss",
  jurisdiction: "US",
  doc_id: "d1",
  title: "T",
  published_at: "2026-05-25T00:00:00Z",
  sha256: "a".repeat(64),
  body: "b",
  ...overrides,
});

export const stubAdapter = (
  hits: { snippet: string; score: number; doc: ComplianceDoc }[],
  spy?: (q: SearchAdapterQuery) => void,
): SearchAdapter => ({
  query: async (q) => {
    spy?.(q);
    return { hits, latencyMs: 12 };
  },
});

export const errAdapter: SearchAdapter = {
  query: async () => {
    throw new Error("rag-down");
  },
};

export const baseConfig = (
  adapter: SearchAdapter,
  audit?: BrainApiConfig["audit"],
): BrainApiConfig => ({
  version: "0.1.0-test",
  startedAtMs: 0,
  auth: okVerifier,
  audit: audit ?? { sink: () => undefined },
  requiredRole: "aml:decision:write",
  search: { adapter },
});

export const body = (j: unknown): RequestInit => ({
  method: "POST",
  headers: {
    Authorization: "Bearer good",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(j),
});

export const failingSinks = (): {
  sink: () => void;
  fallbackSink: () => void;
} => ({
  sink: () => {
    throw new Error("primary");
  },
  fallbackSink: () => {
    throw new Error("fallback");
  },
});
