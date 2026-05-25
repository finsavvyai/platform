import { describe, expect, it } from "vitest";
import {
  buildApp,
  claims,
  errorClient,
  post,
  validBody,
} from "./test-helpers.js";

describe("server.createApp /v1/aml/decision", () => {
  it("happy path → 200 with AmlDecision shape", async () => {
    const app = buildApp();
    const res = await post(app, validBody, { authorization: "Bearer tok" });
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.decision_id).toBe("dec_test");
    expect(json.tenant_id).toBe("tenantA");
    expect(Array.isArray(json.engine_results)).toBe(true);
    expect(json.recommended_action).toBe("allow");
  });

  it("missing Authorization → 401", async () => {
    const app = buildApp();
    const res = await post(app, validBody);
    expect(res.status).toBe(401);
  });

  it("malformed Authorization (no bearer scheme) → 401", async () => {
    const app = buildApp();
    const res = await post(app, validBody, { authorization: "Basic xyz" });
    expect(res.status).toBe(401);
  });

  it("invalid JWT (verify returns null) → 401", async () => {
    const app = buildApp({ verifyJwt: async () => null });
    const res = await post(app, validBody, { authorization: "Bearer bad" });
    expect(res.status).toBe(401);
  });

  it("missing role → 403", async () => {
    const app = buildApp({
      verifyJwt: async () => claims({ roles: [] }),
    });
    const res = await post(app, validBody, { authorization: "Bearer tok" });
    expect(res.status).toBe(403);
  });

  it("tenant mismatch (jwt vs body) → 403", async () => {
    const app = buildApp({
      verifyJwt: async () => claims({ tenant_id: "tenantB" }),
    });
    const res = await post(app, validBody, { authorization: "Bearer tok" });
    expect(res.status).toBe(403);
  });

  it("jwt has no tenant_id → 403", async () => {
    const app = buildApp({
      verifyJwt: async () => claims({ tenant_id: undefined as unknown as string }),
    });
    const res = await post(app, validBody, { authorization: "Bearer tok" });
    expect(res.status).toBe(403);
  });

  it("missing tenant_id in body → 400", async () => {
    const app = buildApp();
    const res = await post(
      app,
      { ...validBody, tenant_id: undefined },
      { authorization: "Bearer tok" },
    );
    expect(res.status).toBe(400);
  });

  it("body missing subject → 400", async () => {
    const app = buildApp();
    const res = await post(
      app,
      { ...validBody, subject: undefined },
      { authorization: "Bearer tok" },
    );
    expect(res.status).toBe(400);
  });

  it("body amount_minor not an integer → 400", async () => {
    const app = buildApp();
    const res = await post(
      app,
      {
        ...validBody,
        transaction: { ...validBody.transaction, amount_minor: 12.34 },
      },
      { authorization: "Bearer tok" },
    );
    expect(res.status).toBe(400);
  });

  it("malformed JSON body → 400", async () => {
    const app = buildApp();
    const res = await app.request("/v1/aml/decision", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer tok",
      },
      body: "{not json",
    });
    expect(res.status).toBe(400);
  });

  it("engine all-fail → 200 with AmlDecision carrying errors (NOT 500)", async () => {
    const app = buildApp({ qb: errorClient("quantumbeam") });
    const res = await post(app, validBody, { authorization: "Bearer tok" });
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    const results = json.engine_results as Array<{ error?: string }>;
    expect(results[0]?.error).toBe("timeout");
  });

  it("audit emit failure → 503", async () => {
    const app = buildApp({
      audit: {
        emit: async () => {
          throw new Error("audit sink down");
        },
      },
    });
    const res = await post(app, validBody, { authorization: "Bearer tok" });
    expect(res.status).toBe(503);
  });
});
