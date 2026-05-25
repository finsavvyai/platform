/**
 * Preserved E2E spec — health endpoint.
 *
 * Source: portfolio/fintech-suite/api-gateway/e2e-tests/tests/health/health.spec.ts
 *
 * STATUS: describe.skip
 *
 * REASON: Requires a Playwright runner targeting a live worker (either
 * `wrangler dev` on a port, or a deployed staging URL). Vitest in this
 * package only runs in-process unit tests. To activate this suite:
 *
 *   1. Add Playwright as a devDep here:
 *        pnpm add -D @playwright/test
 *   2. Add a playwright.config.ts in this directory pointing at the worker URL.
 *   3. Replace `describe.skip` with `describe` below.
 *   4. Update the assertions to call the new edge surface (`/v1/complete`
 *      requires a Bearer token; `/health` is unauth and returns
 *      `{ "status": "ok" }`, per `src/edge/handler.ts`).
 *
 * The original PipeWarden spec asserted `healthData.status === 'healthy'`
 * and the presence of `version` + `timestamp` fields. Our promoted handler
 * returns a slimmer `{ status: 'ok' }` shape; adjust assertions accordingly
 * when re-enabling.
 */

import { describe, expect, it } from "vitest";

describe.skip("[e2e/preserved] health endpoint", () => {
  const baseUrl = process.env["AI_GATEWAY_E2E_URL"] ?? "http://localhost:8787";

  it("returns 200 with status 'ok'", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  it("emits hardened security headers", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it("responds quickly (p95 < 500ms)", async () => {
    const samples = Array.from({ length: 20 });
    const times: number[] = [];
    for (let i = 0; i < samples.length; i++) {
      const start = performance.now();
      await fetch(`${baseUrl}/health`);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)]!;
    expect(p95).toBeLessThan(500);
  });

  it("handles concurrent health checks consistently", async () => {
    const N = 10;
    const responses = await Promise.all(
      Array.from({ length: N }, () => fetch(`${baseUrl}/health`)),
    );
    for (const r of responses) expect(r.status).toBe(200);
    const bodies = (await Promise.all(responses.map((r) => r.json()))) as Array<{
      status: string;
    }>;
    for (const b of bodies) expect(b.status).toBe(bodies[0]!.status);
  });
});
