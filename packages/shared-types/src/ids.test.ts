import { describe, expect, it } from "vitest";
import {
  asActorId,
  asAuditId,
  asCaseId,
  asEngineVersion,
  asSubjectId,
} from "./ids.js";

describe("branded id constructors", () => {
  it.each([
    ["asSubjectId", asSubjectId],
    ["asCaseId", asCaseId],
    ["asActorId", asActorId],
    ["asAuditId", asAuditId],
    ["asEngineVersion", asEngineVersion],
  ] as const)("%s accepts non-empty strings", (_, ctor) => {
    expect(ctor("abc")).toBe("abc");
  });

  it.each([
    ["asSubjectId", asSubjectId],
    ["asCaseId", asCaseId],
    ["asActorId", asActorId],
    ["asAuditId", asAuditId],
    ["asEngineVersion", asEngineVersion],
  ] as const)("%s rejects empty strings", (_, ctor) => {
    expect(() => ctor("")).toThrow(/must be non-empty string/);
  });
});
