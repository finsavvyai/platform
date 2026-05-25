import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Insight, SignalEvent } from "../src/types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const testdata = (name: string) =>
  resolve(here, "..", "..", "testdata", name);

test("golden signal_event parses to SignalEvent", () => {
  const raw = readFileSync(testdata("signal_event.golden.json"), "utf8");
  const s = JSON.parse(raw) as SignalEvent;
  assert.equal(s.id, "8c3c7b4c-0f6c-4b02-9c4a-2a2b8e6f2a11");
  assert.equal(s.source, "llm_gateway");
  assert.equal(s.event_type, "request");
  assert.equal(s.model, "claude-opus-4-7");
  assert.equal(s.occurred_at, "2026-04-20T09:15:42Z");
  assert.equal((s.payload as Record<string, unknown>).prompt_tokens, 1842);
});

test("golden insight parses to Insight", () => {
  const raw = readFileSync(testdata("insight.golden.json"), "utf8");
  const ins = JSON.parse(raw) as Insight;
  assert.equal(ins.pattern_id, "prompt_injection.v1");
  assert.equal(ins.severity, 4);
  assert.equal(ins.impact_score, 0.684);
  assert.equal(ins.evidence_ids.length, 2);
  assert.equal(ins.score_breakdown.blast, 0.9);
});
