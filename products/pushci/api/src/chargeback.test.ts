import { describe, it, expect, vi } from "vitest";
import { computeChargeback, CHARGEBACK_RATE_USD_PER_MIN } from "./chargeback";
import type { Env } from "./types";

function fakeDb(rows: Array<{
  team: string | null;
  project_count: number;
  total_runs: number;
  total_seconds: number;
}>): Env {
  const all = vi.fn().mockResolvedValue({ results: rows });
  const bind = vi.fn().mockReturnValue({ all });
  const prepare = vi.fn().mockReturnValue({ bind });
  return { DB: { prepare } } as unknown as Env;
}

describe("computeChargeback", () => {
  it("groups runs by team and converts seconds → minutes → $", async () => {
    const db = fakeDb([
      { team: "platform", project_count: 3, total_runs: 120, total_seconds: 3600 },
      { team: "mobile", project_count: 1, total_runs: 40, total_seconds: 600 },
    ]);
    const report = await computeChargeback(db, "org1", 0, 1_000_000);
    expect(report.rows).toHaveLength(2);

    const platform = report.rows.find((r) => r.team === "platform")!;
    expect(platform.totalMinutes).toBe(60);
    expect(platform.costSavedUsd).toBe(Math.round(60 * CHARGEBACK_RATE_USD_PER_MIN * 100) / 100);
    expect(platform.projectCount).toBe(3);
  });

  it("coalesces nulls to 'unassigned'", async () => {
    const db = fakeDb([{ team: null, project_count: 2, total_runs: 10, total_seconds: 120 }]);
    const report = await computeChargeback(db, "org1", 0, 1_000_000);
    expect(report.rows[0].team).toBe("unassigned");
  });

  it("returns zero totals on empty result", async () => {
    const report = await computeChargeback(fakeDb([]), "org1", 0, 1);
    expect(report.rows).toEqual([]);
    expect(report.totals).toEqual({ runs: 0, minutes: 0, costSavedUsd: 0 });
  });

  it("sums per-team rows into totals", async () => {
    const db = fakeDb([
      { team: "a", project_count: 1, total_runs: 10, total_seconds: 600 },
      { team: "b", project_count: 1, total_runs: 5, total_seconds: 300 },
    ]);
    const report = await computeChargeback(db, "org1", 0, 1_000_000);
    expect(report.totals.runs).toBe(15);
    expect(report.totals.minutes).toBe(15);
    expect(report.totals.costSavedUsd).toBe(
      Math.round(15 * CHARGEBACK_RATE_USD_PER_MIN * 100) / 100,
    );
  });

  it("stamps the date window in ISO", async () => {
    const report = await computeChargeback(fakeDb([]), "org1", 1_700_000_000_000, 1_700_086_400_000);
    expect(report.startIso).toBe(new Date(1_700_000_000_000).toISOString());
    expect(report.endIso).toBe(new Date(1_700_086_400_000).toISOString());
  });
});
