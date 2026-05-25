// Migration path for the L-003 envelope encryption rollout: existing
// deployments have plain-JSON StoredCreds already in KV. On read we must
// accept them; on the next write we must upgrade them to an envelope.

import { describe, it, expect, afterEach, vi } from "vitest";
import { AWS_SUB, awsToken, callAws, makeEnv, seedCreds } from "./aws-test-helpers";
import { isEnvelope } from "./crypto-envelope";

const originalFetch = globalThis.fetch;

const legacyRole = JSON.stringify({
  region: "us-west-2",
  mode: "role",
  roleArn: "arn:aws:iam::7:role/Legacy",
  externalId: "legacy-ext-sixteen-chr",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
});

describe("Legacy plaintext KV migration (L-003)", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("reads legacy plain-JSON KV values written before v1.6.7", async () => {
    const env = makeEnv();
    await env.RUNNERS.put(`aws:creds:${AWS_SUB}`, legacyRole);
    const res = await callAws(env, "/credentials", { bearer: await awsToken() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      configured: boolean;
      credentials: { roleArn: string };
    };
    expect(body.configured).toBe(true);
    expect(body.credentials.roleArn).toBe("arn:aws:iam::7:role/Legacy");
  });

  it("next write re-encrypts legacy plain-JSON into an envelope", async () => {
    const env = makeEnv();
    await env.RUNNERS.put(`aws:creds:${AWS_SUB}`, legacyRole);
    const res = await seedCreds(env, {
      region: "us-west-2",
      roleArn: "arn:aws:iam::7:role/Legacy",
      externalId: "legacy-ext-sixteen-chr",
    });
    expect(res.status).toBe(200);
    const raw = await env.RUNNERS.get(`aws:creds:${AWS_SUB}`);
    expect(raw).not.toBeNull();
    expect(isEnvelope(raw!)).toBe(true);
  });
});
