import { describe, expect, it } from "vitest";
import {
  ALL_LAYERS,
  ALL_LIST_IDS,
  isLayer,
  isListId,
  isPepStatus,
  isRiskLevel,
} from "./types.js";

describe("type guards", () => {
  it("isListId accepts every official list id", () => {
    for (const id of ALL_LIST_IDS) expect(isListId(id)).toBe(true);
  });
  it("isListId rejects unknown ids", () => {
    expect(isListId("worldcheck")).toBe(false);
    expect(isListId("")).toBe(false);
  });

  it("isLayer accepts every official layer", () => {
    for (const l of ALL_LAYERS) expect(isLayer(l)).toBe(true);
  });
  it("isLayer rejects unknown layers", () => {
    expect(isLayer("graph")).toBe(false);
  });

  it("isRiskLevel covers all four branches", () => {
    expect(isRiskLevel("clear")).toBe(true);
    expect(isRiskLevel("low")).toBe(true);
    expect(isRiskLevel("medium")).toBe(true);
    expect(isRiskLevel("high")).toBe(true);
    expect(isRiskLevel("extreme")).toBe(false);
  });

  it("isPepStatus covers all four branches", () => {
    expect(isPepStatus("none")).toBe(true);
    expect(isPepStatus("current")).toBe(true);
    expect(isPepStatus("former")).toBe(true);
    expect(isPepStatus("associate")).toBe(true);
    expect(isPepStatus("retired")).toBe(false);
  });
});
