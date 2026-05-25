// I-001 regression (v1.6.6 audit): Cepien routes must be 404 by default.
// Mounting them on the main `app` is gated behind ENABLE_CEPIEN — any stray
// webhook sent before the flag is flipped should see "this endpoint doesn't
// exist" (404), never "bad signature" (401). That way a future schema-drift
// on Cepien's side doesn't silently poll a dead endpoint.

import { describe, it, expect, vi } from "vitest";
import worker from "./index";
import type { Env } from "./types";

function makeKv(): KVNamespace {
  const store = new Map<string, string>();
  return {
    async get(k: string) { return store.get(k) ?? null; },
    async put(k: string, v: string) { store.set(k, v); },
    async delete(k: string) { store.delete(k); },
    async list({ prefix }: { prefix?: string } = {}) {
      return {
        keys: [...store.keys()]
          .filter((k) => !prefix || k.startsWith(prefix))
          .map((name) => ({ name })),
        list_complete: true,
        cursor: "",
      };
    },
  } as unknown as KVNamespace;
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    RUNNERS: makeKv(),
    APP_URL: "https://app.pushci.dev",
    JWT_SECRET: "test-jwt-secret",
    ...overrides,
  } as unknown as Env;
}

function webhookRequest(): Request {
  return new Request("https://api.local/api/integrations/cepien/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-cepien-signature": "sha256=deadbeef" },
    body: JSON.stringify({ event: "recommendation.code_generated" }),
  });
}

describe("Cepien feature flag (I-001)", () => {
  it("ENABLE_CEPIEN unset → POST /webhook returns 404", async () => {
    const res = await worker.fetch(webhookRequest(), makeEnv());
    expect(res.status).toBe(404);
  });

  it.each(["", "0", "false", "no"])(
    "ENABLE_CEPIEN=%j (falsy) → 404",
    async (flag) => {
      const res = await worker.fetch(webhookRequest(), makeEnv({ ENABLE_CEPIEN: flag }));
      expect(res.status).toBe(404);
    }
  );

  it.each(["1", "true"])(
    "ENABLE_CEPIEN=%j (enabled) → route mounted (not 404 from the flag gate)",
    async (flag) => {
      // Silence the handler's console.log so the test output stays clean.
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
      const res = await worker.fetch(webhookRequest(), makeEnv({ ENABLE_CEPIEN: flag }));
      // Payload is bogus on purpose — handler should reject at validation
      // (400) or signature check, not at the mount gate (404). A 400 here
      // proves the route is mounted and actively processing requests.
      expect(res.status).not.toBe(404);
      expect([400, 401, 404]).toContain(res.status);
      // Explicitly: handler reached validatePayload and returned 400.
      expect(res.status).toBe(400);
      logSpy.mockRestore();
    }
  );

  it("GET /api/integrations/cepien/connections → 404 when flag unset (not 401)", async () => {
    const req = new Request("https://api.local/api/integrations/cepien/connections");
    const res = await worker.fetch(req, makeEnv());
    expect(res.status).toBe(404);
  });
});
