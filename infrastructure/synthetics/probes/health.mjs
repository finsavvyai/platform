// Health probe — GET /health.
// Asserts contract §1 shape: { status: "ok"|"degraded"|"down", version, uptime_s, checks }.
// Fails if status != "ok" or shape is wrong.

import { assert, fetchWithTimeout, now, result } from "./_lib.mjs";

export const name = "health";

export async function run({ baseUrl, timeoutMs = 10_000 }) {
  const start = now();
  try {
    assert(baseUrl, "baseUrl required");
    const res = await fetchWithTimeout(
      `${baseUrl}/health`,
      { method: "GET", headers: { accept: "application/json" } },
      timeoutMs,
    );
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const body = await res.json();
    assert(
      body && typeof body === "object",
      "health body must be JSON object",
    );
    assert(
      body.status === "ok" || body.status === "degraded" || body.status === "down",
      `invalid status '${body.status}'`,
    );
    assert(body.status === "ok", `health not ok: ${body.status}`);
    assert(typeof body.version === "string", "missing version string");
    assert(
      typeof body.uptime_s === "number" && body.uptime_s >= 0,
      "missing/invalid uptime_s",
    );
    assert(Array.isArray(body.checks), "checks must be array");
    return result(name, true, start);
  } catch (err) {
    return result(name, false, start, err?.message ?? String(err));
  }
}
