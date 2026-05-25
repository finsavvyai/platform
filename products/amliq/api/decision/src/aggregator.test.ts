import { describe, expect, it } from "vitest";
import {
  BLOCK_THRESHOLD,
  FLAG_THRESHOLD,
  aggregate,
} from "./aggregator.js";
import type { EngineResult } from "./types.js";

const ok = (
  engine: EngineResult["engine"],
  score: number,
  explanations: string[] = [],
): EngineResult => ({
  engine,
  risk_score: score,
  explanations,
  latency_ms: 10,
});

const err = (
  engine: EngineResult["engine"],
  error = "timeout",
): EngineResult => ({
  engine,
  risk_score: 0,
  explanations: [`engine.${engine}.${error}`],
  latency_ms: 200,
  error,
});

describe("aggregator.aggregate", () => {
  it("empty results → safe default: allow, conf 0, not partial", () => {
    const out = aggregate([]);
    expect(out.recommended_action).toBe("allow");
    expect(out.max_risk_score).toBe(0);
    expect(out.confidence).toBe(0);
    expect(out.partial).toBe(false);
    expect(out.aggregated_explanation).toEqual([]);
  });

  it("all engines errored → safe default: allow, conf 0, not partial", () => {
    const out = aggregate([err("quantumbeam"), err("ml-fraud", "http_503")]);
    expect(out.recommended_action).toBe("allow");
    expect(out.confidence).toBe(0);
    expect(out.partial).toBe(false);
    // explanations from error results still merged for analyst context
    expect(out.aggregated_explanation).toContain("engine.quantumbeam.timeout");
  });

  it("single successful engine → score wins, confidence 1.0", () => {
    const out = aggregate([ok("quantumbeam", 72, ["rule_A"])]);
    expect(out.max_risk_score).toBe(72);
    expect(out.confidence).toBe(1);
    expect(out.recommended_action).toBe("flag");
  });

  it("score >= block threshold → block", () => {
    const out = aggregate([ok("quantumbeam", BLOCK_THRESHOLD)]);
    expect(out.recommended_action).toBe("block");
  });

  it("score >= flag threshold but < block → flag", () => {
    const out = aggregate([ok("quantumbeam", FLAG_THRESHOLD)]);
    expect(out.recommended_action).toBe("flag");
  });

  it("score < flag threshold → allow", () => {
    const out = aggregate([ok("quantumbeam", FLAG_THRESHOLD - 1)]);
    expect(out.recommended_action).toBe("allow");
  });

  it("identical scores from two engines → confidence 1.0", () => {
    const out = aggregate([ok("quantumbeam", 50), ok("ml-fraud", 50)]);
    expect(out.confidence).toBe(1);
    expect(out.max_risk_score).toBe(50);
  });

  it("two engines, both zero → confidence 1.0 (zero-mean guard)", () => {
    const out = aggregate([ok("quantumbeam", 0), ok("ml-fraud", 0)]);
    expect(out.confidence).toBe(1);
    expect(out.max_risk_score).toBe(0);
  });

  it("divergent engines → confidence drops below 1", () => {
    const out = aggregate([ok("quantumbeam", 20), ok("ml-fraud", 90)]);
    expect(out.confidence).toBeLessThan(1);
    expect(out.confidence).toBeGreaterThanOrEqual(0);
    expect(out.max_risk_score).toBe(90);
  });

  it("max-score wins (never averaged)", () => {
    const out = aggregate([ok("quantumbeam", 10), ok("ml-fraud", 95)]);
    expect(out.max_risk_score).toBe(95);
    expect(out.recommended_action).toBe("block");
  });

  it("clamps risk scores into 0..100", () => {
    const out = aggregate([
      ok("quantumbeam", 150),
      ok("ml-fraud", -10),
    ]);
    expect(out.max_risk_score).toBe(100);
  });

  it("merges + dedupes explanations preserving order", () => {
    const out = aggregate([
      ok("quantumbeam", 30, ["x", "y"]),
      ok("ml-fraud", 40, ["y", "z"]),
    ]);
    expect(out.aggregated_explanation).toEqual(["x", "y", "z"]);
  });

  it("one success + one error → partial=true", () => {
    const out = aggregate([ok("quantumbeam", 60), err("ml-fraud")]);
    expect(out.partial).toBe(true);
    expect(out.max_risk_score).toBe(60);
  });

  it("confidence clipped to [0,1] even for extreme dispersion", () => {
    const out = aggregate([
      ok("quantumbeam", 1),
      ok("ml-fraud", 100),
    ]);
    expect(out.confidence).toBeGreaterThanOrEqual(0);
    expect(out.confidence).toBeLessThanOrEqual(1);
  });
});
