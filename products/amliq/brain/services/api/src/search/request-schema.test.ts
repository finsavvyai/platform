import { describe, expect, it } from "vitest";
import { parseSearchRequest } from "./request-schema.js";

describe("search request schema", () => {
  it("trims required string fields and keeps numeric top_k", () => {
    expect(parseSearchRequest({
      q: "  fincen  ",
      tenant_id: " tenant-a ",
      top_k: 3,
      ignored: true,
    })).toStrictEqual({
      q: "fincen",
      tenant_id: "tenant-a",
      top_k: 3,
    });
  });

  it("returns null for non-object bodies and omits invalid optional top_k", () => {
    expect(parseSearchRequest(null)).toBeNull();
    expect(parseSearchRequest([])).toBeNull();
    expect(parseSearchRequest({
      q: "x",
      tenant_id: "t",
      top_k: "5",
    })).toStrictEqual({ q: "x", tenant_id: "t" });
  });
});
