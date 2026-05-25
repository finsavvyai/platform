/**
 * Test-only helpers for audit-prod specs. Kept out of the build via
 * `*.test-helpers.ts` exclusion in tsconfig.json + vitest config.
 */

import type { D1Client, D1PreparedStatement } from "./state-store.js";

export type Captured = {
  sql: string;
  bindings: readonly (string | number | null)[];
};

export interface FakeRow {
  last_hash: string;
  sequence_id: number;
}

export const makeFakeD1 = (
  rowsByTenant: Record<string, FakeRow | null> = {},
): {
  d1: D1Client;
  calls: Captured[];
  runShouldFailAfter: (n: number) => void;
} => {
  const calls: Captured[] = [];
  let failAfterN = Infinity;
  let runCount = 0;
  const d1: D1Client = {
    prepare(sql: string): D1PreparedStatement {
      let bound: readonly (string | number | null)[] = [];
      const stmt: D1PreparedStatement = {
        bind(...values) {
          bound = values;
          return stmt;
        },
        async first<T = unknown>(): Promise<T | null> {
          calls.push({ sql, bindings: bound });
          const tenant = bound[0];
          if (typeof tenant !== "string") return null;
          const row = rowsByTenant[tenant];
          return (row ?? null) as T | null;
        },
        async run() {
          calls.push({ sql, bindings: bound });
          runCount += 1;
          if (runCount > failAfterN) {
            throw new Error("d1.run.fail");
          }
          return { success: true };
        },
      };
      return stmt;
    },
  };
  return {
    d1,
    calls,
    runShouldFailAfter: (n: number) => {
      failAfterN = n;
    },
  };
};
