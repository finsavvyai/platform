import { describe, expect, it } from "vitest";
import { MockScreenClient } from "./mock.js";

describe("MockScreenClient", () => {
  const fixedNow = (): Date => new Date("2026-05-26T12:00:00.000Z");

  it("returns high-risk match for Vladimir Putin (ofac + eu_fsf)", async () => {
    const c = new MockScreenClient({ now: fixedNow });
    const r = await c.screen({ name: "Vladimir Putin", pep: true });
    expect(r.riskLevel).toBe("high");
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0]?.lists).toEqual(["ofac", "eu_fsf"]);
    expect(r.matches[0]?.pepStatus).toBe("current");
    expect(r.matches[0]?.layers).toHaveLength(5);
    expect(r.screenedAt).toBe("2026-05-26T12:00:00.000Z");
  });

  it("returns clear for common name Mohammad Ali", async () => {
    const c = new MockScreenClient({ now: fixedNow });
    const r = await c.screen({ name: "Mohammad Ali" });
    expect(r.riskLevel).toBe("clear");
    expect(r.matches).toEqual([]);
  });

  it("returns high-risk for Sberbank of Russia (ofac only)", async () => {
    const c = new MockScreenClient({ now: fixedNow });
    const r = await c.screen({ name: "Sberbank of Russia" });
    expect(r.riskLevel).toBe("high");
    expect(r.matches[0]?.lists).toEqual(["ofac"]);
  });

  it("returns medium-risk PEP current for Recep Erdogan", async () => {
    const c = new MockScreenClient({ now: fixedNow });
    const r = await c.screen({ name: "Recep Erdogan", pep: true });
    expect(r.riskLevel).toBe("medium");
    expect(r.matches[0]?.pepStatus).toBe("current");
  });

  it("returns clear with empty matches for unknown name", async () => {
    const c = new MockScreenClient({ now: fixedNow });
    const r = await c.screen({ name: "Some Unknown Person" });
    expect(r.riskLevel).toBe("clear");
    expect(r.matches).toEqual([]);
  });

  it("filters matched lists when request specifies a subset", async () => {
    const c = new MockScreenClient({ now: fixedNow });
    const r = await c.screen({ name: "Vladimir Putin", lists: ["ofac"] });
    expect(r.matches[0]?.lists).toEqual(["ofac"]);
  });

  it("threshold filters out matches below confidence", async () => {
    const c = new MockScreenClient({ now: fixedNow });
    const r = await c.screen({ name: "Recep Erdogan", threshold: 0.9 });
    expect(r.matches).toEqual([]);
    expect(r.riskLevel).toBe("clear");
  });

  it("pep=false suppresses pep status to 'none'", async () => {
    const c = new MockScreenClient({ now: fixedNow });
    const r = await c.screen({ name: "Vladimir Putin", pep: false });
    expect(r.matches[0]?.pepStatus).toBe("none");
  });

  it("name lookup is case + whitespace insensitive", async () => {
    const c = new MockScreenClient({ now: fixedNow });
    const r = await c.screen({ name: "  vladimir PUTIN  " });
    expect(r.riskLevel).toBe("high");
  });

  it("accepts custom fixtures and falls back to default now()", async () => {
    const c = new MockScreenClient({
      fixtures: {
        "acme corp": {
          riskLevel: "low",
          matches: [
            {
              entityId: "x1",
              entityName: "Acme Corp",
              confidence: 0.55,
              lists: ["un"],
              pepStatus: "none",
              scores: { exact: 0.55, fuzzy: 0.5, phonetic: 0.4, token: 0.6, embedding: 0.5 },
            },
          ],
        },
      },
    });
    const r = await c.screen({ name: "Acme Corp" });
    expect(r.riskLevel).toBe("low");
    expect(r.matches[0]?.layers.find((l) => l.layer === "token")?.matched).toBe(false);
    expect(typeof r.screenedAt).toBe("string");
  });

  it("marks layer matched when score >= 0.85", async () => {
    const c = new MockScreenClient({ now: fixedNow });
    const r = await c.screen({ name: "Vladimir Putin" });
    const exact = r.matches[0]?.layers.find((l) => l.layer === "exact");
    expect(exact?.matched).toBe(true);
  });

  it("returns empty list when fixture lists empty (PEP-only match)", async () => {
    const c = new MockScreenClient({ now: fixedNow });
    const r = await c.screen({ name: "Recep Erdogan", lists: ["ofac"] });
    expect(r.matches[0]?.lists).toEqual([]);
  });
});
