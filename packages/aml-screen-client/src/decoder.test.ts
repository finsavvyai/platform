import { describe, expect, it, vi } from "vitest";
import { ScreenClient } from "./client.js";
import { jsonResponse, validResponse } from "./testFixtures.js";

function clientWith(body: unknown): ScreenClient {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body));
  return new ScreenClient({ baseUrl: "http://x.test", fetch: fetchMock });
}

describe("response decoder", () => {
  it("non-object body is rejected", async () => {
    await expect(clientWith(["array"]).screen({ name: "x" })).rejects.toThrow(/not an object/);
  });

  it("missing field rejected", async () => {
    const body = { ...validResponse() } as Record<string, unknown>;
    delete body.query;
    await expect(clientWith(body).screen({ name: "x" })).rejects.toThrow(
      /Missing\/invalid field: query/,
    );
  });

  it("invalid riskLevel rejected", async () => {
    const body = { ...validResponse(), riskLevel: "nuclear" };
    await expect(clientWith(body).screen({ name: "x" })).rejects.toThrow(/Invalid riskLevel/);
  });

  it("invalid pepStatus on a match rejected", async () => {
    const body = validResponse();
    body.matches[0] = { ...body.matches[0]!, pepStatus: "wat" as never };
    await expect(clientWith(body).screen({ name: "x" })).rejects.toThrow(/Invalid pepStatus/);
  });

  it("invalid list id rejected", async () => {
    const body = validResponse();
    body.matches[0] = { ...body.matches[0]!, lists: ["worldcheck" as never] };
    await expect(clientWith(body).screen({ name: "x" })).rejects.toThrow(/Invalid list/);
  });

  it("non-string list element rejected", async () => {
    const body = validResponse();
    body.matches[0] = { ...body.matches[0]!, lists: [42 as never] };
    await expect(clientWith(body).screen({ name: "x" })).rejects.toThrow(/Invalid list/);
  });

  it("non-object match rejected", async () => {
    const body = { ...validResponse(), matches: ["nope"] };
    await expect(clientWith(body).screen({ name: "x" })).rejects.toThrow(/matches\[0\] not object/);
  });

  it("invalid layer name rejected", async () => {
    const body = validResponse();
    body.matches[0]!.layers[0] = { layer: "graph" as never, score: 1, matched: true };
    await expect(clientWith(body).screen({ name: "x" })).rejects.toThrow(/Invalid layer/);
  });

  it("non-object layer rejected", async () => {
    const body = validResponse();
    body.matches[0]!.layers = ["nope" as never];
    await expect(clientWith(body).screen({ name: "x" })).rejects.toThrow(
      /layers\[0\]\[0\] not object/,
    );
  });
});
