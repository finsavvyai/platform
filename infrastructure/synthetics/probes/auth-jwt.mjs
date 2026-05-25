// auth-jwt probe — assert auth boundary correctness.
// Expired/invalid JWT → 401. Valid JWT → 200.

import { assert, fetchWithTimeout, now, result } from "./_lib.mjs";

export const name = "auth-jwt";

// Hardcoded expired token shape. Not a real secret — the server will reject
// the signature regardless. Format: header.payload.bogusSig with exp in 2020.
const EXPIRED_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
  ".eyJzdWIiOiJzeW50aGV0aWMiLCJleHAiOjE1ODAwMDAwMDB9" +
  ".AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

async function post(baseUrl, token, timeoutMs) {
  return fetchWithTimeout(
    `${baseUrl}/v1/complete`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-synthetic-probe": name,
      },
      body: JSON.stringify({ prompt: "ping", tier: "standard" }),
    },
    timeoutMs,
  );
}

export async function run({ baseUrl, jwt, timeoutMs = 10_000 }) {
  const start = now();
  try {
    assert(baseUrl, "baseUrl required");
    assert(jwt, "FINSAVVY_SYNTHETIC_JWT required");
    const bad = await post(baseUrl, EXPIRED_JWT, timeoutMs);
    assert(
      bad.status === 401,
      `expired jwt should yield 401, got ${bad.status}`,
    );
    const good = await post(baseUrl, jwt, timeoutMs);
    assert(
      good.status === 200,
      `valid jwt should yield 200, got ${good.status}`,
    );
    return result(name, true, start);
  } catch (err) {
    return result(name, false, start, err?.message ?? String(err));
  }
}
