// gateway-route probe — POST a test prompt to /v1/complete.
// Expects 200, valid response shape, and token counts present.

import { assert, fetchWithTimeout, now, result } from "./_lib.mjs";

export const name = "gateway-route";

const TEST_PROMPT = "synthetic:route ping — please respond with a single token.";

export async function run({ baseUrl, jwt, timeoutMs = 10_000 }) {
  const start = now();
  try {
    assert(baseUrl, "baseUrl required");
    assert(jwt, "FINSAVVY_SYNTHETIC_JWT required");
    const res = await fetchWithTimeout(
      `${baseUrl}/v1/complete`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${jwt}`,
          "content-type": "application/json",
          "x-synthetic-probe": name,
        },
        body: JSON.stringify({
          prompt: TEST_PROMPT,
          tier: "standard",
        }),
      },
      timeoutMs,
    );
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body && typeof body === "object", "non-object body");
    assert(typeof body.output === "string", "missing output string");
    assert(body.tokens && typeof body.tokens === "object", "missing tokens");
    assert(
      typeof body.tokens.input === "number" && body.tokens.input >= 0,
      "missing tokens.input",
    );
    assert(
      typeof body.tokens.output === "number" && body.tokens.output >= 0,
      "missing tokens.output",
    );
    return result(name, true, start);
  } catch (err) {
    return result(name, false, start, err?.message ?? String(err));
  }
}
