import { describe, expect, it } from "vitest";
import { createDecisionService } from "./decision-service.js";
import { createApp } from "./server.js";
import {
  buildApp,
  claims,
  okClient,
  post,
  validBody,
} from "./test-helpers.js";
import type { AuditEmitter } from "./types.js";

describe("server.createApp /health", () => {
  it("returns mesh §1 shape: status, version, uptime_s, checks[]", async () => {
    const app = buildApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.status).toBe("ok");
    expect(json.version).toBe("test");
    expect(typeof json.uptime_s).toBe("number");
    expect(Array.isArray(json.checks)).toBe(true);
  });

  it("status=degraded when any check reports degraded", async () => {
    const app = buildApp({
      engineHealth: async () => ({ "engine.quantumbeam": "degraded" }),
    });
    const res = await app.request("/health");
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.status).toBe("degraded");
  });

  it("status=down when any check reports down (dominates degraded)", async () => {
    const app = buildApp({
      engineHealth: async () => ({
        "engine.quantumbeam": "degraded",
        "engine.ml_fraud": "down",
      }),
    });
    const res = await app.request("/health");
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.status).toBe("down");
  });

  it("no engineHealth provided → status=ok with empty checks", async () => {
    const audit: AuditEmitter = { emit: async () => {} };
    const service = createDecisionService({
      engineClients: {
        quantumbeam: okClient("quantumbeam"),
        "ml-fraud": okClient("ml-fraud"),
      },
      audit,
      actorIdFor: () => "u",
      newDecisionId: () => "d",
    });
    const app = createApp({
      service,
      verifyJwt: async () => claims(),
      version: "v",
    });
    const res = await app.request("/health");
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.status).toBe("ok");
    expect(json.checks).toEqual([]);
  });
});

describe("server.createApp defensive paths", () => {
  it("unexpected non-AuditEmitFailure error → 500", async () => {
    const fakeService = {
      handle: async () => {
        throw new Error("boom");
      },
    } as unknown as ReturnType<typeof createDecisionService>;
    const app = createApp({
      service: fakeService,
      verifyJwt: async () => claims(),
      version: "test",
    });
    const res = await post(app, validBody, { authorization: "Bearer tok" });
    expect(res.status).toBe(500);
  });
});
