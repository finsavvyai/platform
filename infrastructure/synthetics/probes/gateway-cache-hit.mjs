// gateway-cache-hit probe — POST same prompt twice.
// Second response MUST report cached:true and 0 input tokens billed.

import { assert, fetchWithTimeout, now, result } from "./_lib.mjs";

export const name = "gateway-cache-hit";

const STABLE_PROMPT =
  "synthetic:cache stable prompt — do not vary across runs.";

async function post(baseUrl, jwt, timeoutMs) {
  const res = await fetchWithTimeout(
    `${baseUrl}/v1/complete`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${jwt}`,
        "content-type": "application/json",
        "x-synthetic-probe": name,
      },
      body: JSON.stringify({ prompt: STABLE_PROMPT, tier: "standard" }),
    },
    timeoutMs,
  );
  assert(res.status === 200, `expected 200, got ${res.status}`);
  return res.json();
}

export async function run({ baseUrl, jwt, timeoutMs = 10_000 }) {
  const start = now();
  try {
    assert(baseUrl, "baseUrl required");
    assert(jwt, "FINSAVVY_SYNTHETIC_JWT required");
    // Prime
    await post(baseUrl, jwt, timeoutMs);
    // Hit
    const second = await post(baseUrl, jwt, timeoutMs);
    assert(second.cached === true, `second call not cached (cached=${second.cached})`);
    assert(
      second.tokens && second.tokens.input === 0,
      `cache hit billed input tokens: ${second?.tokens?.input}`,
    );
    return result(name, true, start);
  } catch (err) {
    return result(name, false, start, err?.message ?? String(err));
  }
}
