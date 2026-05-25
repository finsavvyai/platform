import { describe, expect, it } from "vitest";
import { isAmlScoreAuditEvent } from "./audit.js";
import type { AmlScoreAuditEvent, AuditEvent } from "./audit.js";
import {
  asActorId,
  asAuditId,
  asEngineVersion,
} from "./ids.js";

const baseEvent: AuditEvent = {
  id: asAuditId("aud_1"),
  ts: "2026-05-24T20:00:00.000Z",
  actorId: asActorId("act_1"),
  event: "auth.login",
  resource: "session:abc",
  decision: "n/a",
  reason: "ok",
};

const scoreEvent: AmlScoreAuditEvent = {
  id: asAuditId("aud_2"),
  ts: "2026-05-24T20:00:01.000Z",
  actorId: asActorId("act_1"),
  event: "aml.score",
  resource: "subj_hash:deadbeef",
  decision: "review",
  reason: "model_confidence_low",
  engineVersions: {
    quantumbeam: asEngineVersion("v1.0.0"),
    ml_fraud: asEngineVersion("v1.0.0"),
  },
  scores: { quantumbeam: 0.4, ml_fraud: 0.55, blended: 0.48 },
};

describe("isAmlScoreAuditEvent", () => {
  it("returns true for aml.score events", () => {
    expect(isAmlScoreAuditEvent(scoreEvent)).toBe(true);
  });

  it("returns false for non-score events", () => {
    expect(isAmlScoreAuditEvent(baseEvent)).toBe(false);
  });
});
