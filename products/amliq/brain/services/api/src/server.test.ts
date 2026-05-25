import { describe, expect, it } from "vitest";
import { createBrainApp } from "./server.js";
import type {
  AuditChain,
  AuditRecord,
  AuditSink,
  AuthVerifier,
  BrainApiConfig,
  HealthCheck,
} from "./types.js";

const okVerifier: AuthVerifier = {
  verify: async () => ({
    ok: true,
    claims: {
      sub: "alice",
      iss: "iss",
      aud: "amliq-brain",
      exp: Math.floor(Date.now() / 1000) + 3600,
      roles: ["aml:decision:write"],
    },
  }),
};

const collectSink = (
  bucket: AuditRecord[],
): AuditSink => (r) => {
  bucket.push(r);
};

const baseConfig = (
  overrides: Partial<BrainApiConfig> = {},
): BrainApiConfig => {
  const sink = overrides.audit?.sink ?? (() => undefined);
  return {
    version: "0.1.0-test",
    startedAtMs: 0,
    auth: overrides.auth ?? okVerifier,
    audit: {
      sink,
      ...(overrides.audit?.fallbackSink !== undefined
        ? { fallbackSink: overrides.audit.fallbackSink }
        : {}),
      ...(overrides.audit?.chain !== undefined
        ? { chain: overrides.audit.chain }
        : {}),
    },
    ...(overrides.probes !== undefined ? { probes: overrides.probes } : {}),
    requiredRole: overrides.requiredRole ?? "aml:decision:write",
    clock: overrides.clock ?? (() => new Date("2026-05-25T10:00:00.000Z")),
  };
};

describe("createBrainApp", () => {
  it("GET /health returns mesh-shape snapshot with status=ok and 200", async () => {
    const { app } = createBrainApp(baseConfig());
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toStrictEqual({
      status: "ok",
      version: "0.1.0-test",
      uptime_s: expect.any(Number),
      checks: [],
    });
  });

  it("GET /health returns 503 when any probe reports down", async () => {
    const probes = [
      (): HealthCheck => ({ name: "audit.sink", status: "down" }),
    ];
    const { app } = createBrainApp(baseConfig({ probes }));
    const res = await app.request("/health");
    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("down");
  });

  it("POST /v1/brain/ping returns 401 without bearer", async () => {
    const { app } = createBrainApp(baseConfig());
    const res = await app.request("/v1/brain/ping", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("POST /v1/brain/ping returns 200 + emits one audit record on happy path", async () => {
    const records: AuditRecord[] = [];
    const { app } = createBrainApp(
      baseConfig({
        audit: { sink: collectSink(records) },
      }),
    );
    const res = await app.request("/v1/brain/ping", {
      method: "POST",
      headers: { Authorization: "Bearer good" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; ts: string };
    expect(body.ok).toBe(true);
    expect(body.ts).toBe("2026-05-25T10:00:00.000Z");
    expect(records).toHaveLength(1);
    expect(records[0]!.event).toBe("brain.ping");
    expect(records[0]!.actor_id).toBe("alice");
  });

  it("POST /v1/brain/ping wires AuditChain when provided (record carries chain)", async () => {
    const records: AuditRecord[] = [];
    const chain: AuditChain = {
      chainAppend: () => ({ hash: "abc123", sig: "sig-xyz" }),
    };
    const { app } = createBrainApp(
      baseConfig({
        audit: { sink: (r) => records.push(r), chain },
      }),
    );
    const res = await app.request("/v1/brain/ping", {
      method: "POST",
      headers: { Authorization: "Bearer good" },
    });
    expect(res.status).toBe(200);
    expect(records[0]!.chain).toStrictEqual({
      prevHash: "0".repeat(64),
      hash: "abc123",
      sig: "sig-xyz",
    });
  });

  it("POST /v1/brain/ping returns 503 when audit emit hard-fails", async () => {
    const sink: AuditSink = () => {
      throw new Error("primary");
    };
    const fallbackSink: AuditSink = () => {
      throw new Error("fallback");
    };
    const { app } = createBrainApp(
      baseConfig({ audit: { sink, fallbackSink } }),
    );
    const res = await app.request("/v1/brain/ping", {
      method: "POST",
      headers: { Authorization: "Bearer good" },
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toStrictEqual({
      ok: false,
      error: "audit_emit_failed",
    });
  });

  it("createBrainApp works without requiredRole + without clock (defaults)", async () => {
    const records: AuditRecord[] = [];
    // Build a config WITHOUT requiredRole AND WITHOUT clock to exercise
    // both undefined branches in server wiring (exactOptionalPropertyTypes).
    const cfg: BrainApiConfig = {
      version: "0.1.0-test",
      startedAtMs: 0,
      auth: okVerifier,
      audit: { sink: collectSink(records) },
    };
    const { app } = createBrainApp(cfg);
    const res = await app.request("/v1/brain/ping", {
      method: "POST",
      headers: { Authorization: "Bearer good" },
    });
    expect(res.status).toBe(200);
    expect(records).toHaveLength(1);
  });

  it("POST /v1/brain/ping still returns 200 when only the fallback delivers", async () => {
    const fallbackRecords: AuditRecord[] = [];
    const sink: AuditSink = () => {
      throw new Error("primary-down");
    };
    const fallbackSink: AuditSink = (r) => {
      fallbackRecords.push(r);
    };
    const { app } = createBrainApp(
      baseConfig({ audit: { sink, fallbackSink } }),
    );
    const res = await app.request("/v1/brain/ping", {
      method: "POST",
      headers: { Authorization: "Bearer good" },
    });
    expect(res.status).toBe(200);
    expect(fallbackRecords).toHaveLength(1);
  });
});
