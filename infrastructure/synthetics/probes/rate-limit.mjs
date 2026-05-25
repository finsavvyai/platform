// rate-limit probe — burst 100 requests, expect tail to be 429.
// Threshold: at least 1 of last 20 requests must be 429.
// Uses a synthetic tenant id (via JWT) — must not pollute real customer quota.

import { assert, fetchWithTimeout, now, result } from "./_lib.mjs";

export const name = "rate-limit";

const BURST = 100;
const TAIL_WINDOW = 20;
const TAIL_THRESHOLD = 1;

export async function run({ baseUrl, jwt, timeoutMs = 10_000 }) {
  const start = now();
  try {
    assert(baseUrl, "baseUrl required");
    assert(jwt, "FINSAVVY_SYNTHETIC_JWT required");

    const tasks = [];
    for (let i = 0; i < BURST; i += 1) {
      tasks.push(
        fetchWithTimeout(
          `${baseUrl}/v1/complete`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${jwt}`,
              "content-type": "application/json",
              "x-synthetic-probe": name,
              "x-burst-index": String(i),
            },
            body: JSON.stringify({ prompt: `burst-${i}`, tier: "standard" }),
          },
          timeoutMs,
        ).then((r) => r.status).catch(() => 0),
      );
    }
    const statuses = await Promise.all(tasks);
    const tail = statuses.slice(-TAIL_WINDOW);
    const limited = tail.filter((s) => s === 429).length;
    assert(
      limited >= TAIL_THRESHOLD,
      `expected >=${TAIL_THRESHOLD} 429 in tail of ${TAIL_WINDOW}, got ${limited}`,
    );
    return result(name, true, start);
  } catch (err) {
    return result(name, false, start, err?.message ?? String(err));
  }
}
