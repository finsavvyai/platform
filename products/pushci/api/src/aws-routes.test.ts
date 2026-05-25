// Route-level tests for the v1.6.6 L-003 fixes on /api/aws/credentials.
// Covers: static-mode gate, KV envelope encryption, redacted GET.
// Legacy-plaintext migration tests live in aws-creds-migration.test.ts.

import { describe, it, expect, afterEach, vi } from "vitest";
import {
  AWS_SUB,
  AWS_TEST_ENC_KEY,
  awsToken,
  callAws,
  makeEnv,
  seedCreds,
} from "./aws-test-helpers";
import { isEnvelope } from "./crypto-envelope";

const originalFetch = globalThis.fetch;

describe("POST /credentials static-mode gate (L-003)", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("rejects static keys when PUSHCI_ALLOW_STATIC_CREDS is unset", async () => {
    const env = makeEnv({ PUSHCI_ALLOW_STATIC_CREDS: undefined });
    const res = await seedCreds(env, {
      region: "us-east-1",
      accessKeyId: "AKIA_LIVE",
      secretAccessKey: "live-secret",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/static AWS access keys are disabled/i);
  });

  it("accepts static keys when PUSHCI_ALLOW_STATIC_CREDS=1", async () => {
    const env = makeEnv({ PUSHCI_ALLOW_STATIC_CREDS: "1" });
    const res = await seedCreds(env, {
      region: "us-east-1",
      accessKeyId: "AKIA_LIVE",
      secretAccessKey: "live-secret",
    });
    expect(res.status).toBe(200);
  });

  it("role mode is never gated by the static-creds flag", async () => {
    const env = makeEnv({ PUSHCI_ALLOW_STATIC_CREDS: undefined });
    const res = await seedCreds(env, {
      region: "us-east-1",
      roleArn: "arn:aws:iam::1:role/X",
    });
    expect(res.status).toBe(200);
  });

  it("refuses to write when PUSHCI_CRED_ENCRYPTION_KEY is unset", async () => {
    const env = makeEnv({ PUSHCI_CRED_ENCRYPTION_KEY: undefined });
    const res = await seedCreds(env, {
      region: "us-east-1",
      roleArn: "arn:aws:iam::1:role/X",
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/PUSHCI_CRED_ENCRYPTION_KEY/);
  });
});

describe("POST /credentials envelope encryption at rest (L-003)", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("KV value is an encrypted envelope, NOT plain StoredCreds JSON", async () => {
    const env = makeEnv();
    const res = await seedCreds(env, {
      region: "us-east-1",
      accessKeyId: "AKIA_LIVE",
      secretAccessKey: "live-super-secret",
    });
    expect(res.status).toBe(200);
    const raw = await env.RUNNERS.get(`aws:creds:${AWS_SUB}`);
    expect(raw).not.toBeNull();
    // Must NOT contain plaintext secret material.
    expect(raw!).not.toContain("live-super-secret");
    expect(raw!).not.toContain("AKIA_LIVE");
    expect(raw!).not.toContain("secretAccessKey");
    // Must be a v1 envelope.
    expect(isEnvelope(raw!)).toBe(true);
  });

  it("GET /credentials returns decrypted redacted view", async () => {
    const env = makeEnv();
    await seedCreds(env, {
      region: "us-east-1",
      accessKeyId: "AKIAABCDEFGH",
      secretAccessKey: "very-long-secret-value",
    });
    const res = await callAws(env, "/credentials", { bearer: await awsToken() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      configured: boolean;
      credentials: { accessKeyId: string; mode: string; region: string };
    };
    expect(body.configured).toBe(true);
    expect(body.credentials.region).toBe("us-east-1");
    expect(body.credentials.mode).toBe("static");
    // Redacted: first-4 + ellipsis + last-4.
    expect(body.credentials.accessKeyId).toBe("AKIA…EFGH");
    // Secret must never appear in the response.
    expect(JSON.stringify(body)).not.toContain("very-long-secret-value");
  });

  it("round-trip via GET decrypts the stored envelope correctly", async () => {
    const env = makeEnv();
    await seedCreds(env, {
      region: "eu-west-2",
      roleArn: "arn:aws:iam::999:role/Prod",
      externalId: "ext-sixteen-char-min",
    });
    const res = await callAws(env, "/credentials", { bearer: await awsToken() });
    const body = (await res.json()) as {
      configured: boolean;
      credentials: { roleArn: string; region: string; mode: string };
    };
    expect(body.credentials.roleArn).toBe("arn:aws:iam::999:role/Prod");
    expect(body.credentials.region).toBe("eu-west-2");
    expect(body.credentials.mode).toBe("role");
  });

  it("different master keys produce unrelated ciphertexts", async () => {
    const envA = makeEnv({ PUSHCI_CRED_ENCRYPTION_KEY: AWS_TEST_ENC_KEY });
    const envB = makeEnv({
      PUSHCI_CRED_ENCRYPTION_KEY:
        "____________________________________________".slice(0, 43),
    });
    await seedCreds(envA, { region: "us-east-1", roleArn: "arn:aws:iam::1:role/X" });
    await seedCreds(envB, { region: "us-east-1", roleArn: "arn:aws:iam::1:role/X" });
    const rawA = await envA.RUNNERS.get(`aws:creds:${AWS_SUB}`);
    const rawB = await envB.RUNNERS.get(`aws:creds:${AWS_SUB}`);
    expect(rawA).not.toBe(rawB);
  });
});
