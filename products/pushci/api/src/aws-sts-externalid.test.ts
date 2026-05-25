// Tests for M-004 (v1.6.6 audit): AWS STS Role mode must enforce a
// per-tenant ExternalId to prevent the confused-deputy attack where
// any principal that learns a customer's role ARN could call
// sts:AssumeRole against it.
//
// Matrix:
// - static mode unaffected by externalId policy
// - role mode without externalId → 200 + generatedExternalId + warning
// - role mode with short externalId (< 16 chars) → 400
// - role mode with valid externalId → stored & forwarded to STS
// - STS request body includes ExternalId=<value>
// - GET /credentials redacts externalId as prefix…suffix (not full)
// - resolveExternalId unit invariants

import { describe, it, expect, afterEach, vi } from "vitest";
import {
  AWS_OK_XML,
  awsToken,
  callAws,
  installAwsRouter,
  makeEnv,
  seedCreds,
} from "./aws-test-helpers";
import { EXTERNAL_ID_MIN_LEN } from "./aws-externalid";

const originalFetch = globalThis.fetch;

describe("M-004 POST /credentials — externalId policy", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("static mode does not require or store externalId", async () => {
    const env = makeEnv();
    const res = await seedCreds(env, {
      region: "us-east-1",
      accessKeyId: "AKIASTATIC",
      secretAccessKey: "staticsecret",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      credentials: { mode: string; externalId?: string };
      generatedExternalId?: string;
    };
    expect(body.credentials.mode).toBe("static");
    expect(body.credentials.externalId).toBeUndefined();
    expect(body.generatedExternalId).toBeUndefined();
  });

  it("role mode without externalId → 200 + auto-generated 32-char hex", async () => {
    const env = makeEnv();
    const res = await seedCreds(env, {
      region: "us-east-1",
      roleArn: "arn:aws:iam::1:role/X",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      generatedExternalId: string;
      warnings: string[];
      credentials: { externalId: string };
    };
    expect(body.generatedExternalId).toMatch(/^[0-9a-f]{32}$/);
    expect(body.warnings.some((w) => /confused-deputy|trust policy/i.test(w))).toBe(true);
    // Redacted form in credentials — full value only in generatedExternalId.
    expect(body.credentials.externalId).not.toBe(body.generatedExternalId);
  });

  it("role mode with short externalId (< 16 chars) → 400", async () => {
    const env = makeEnv();
    const res = await seedCreds(env, {
      region: "us-east-1",
      roleArn: "arn:aws:iam::1:role/X",
      externalId: "too-short",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(new RegExp(`at least ${EXTERNAL_ID_MIN_LEN}`));
    expect(body.error).toMatch(/confused-deputy/i);
  });

  it("role mode with exactly min-length externalId → accepted", async () => {
    const env = makeEnv();
    const ext = "a".repeat(EXTERNAL_ID_MIN_LEN);
    const res = await seedCreds(env, {
      region: "us-east-1",
      roleArn: "arn:aws:iam::1:role/X",
      externalId: ext,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { generatedExternalId?: string };
    expect(body.generatedExternalId).toBeUndefined(); // user-supplied, not generated
  });

  it("role mode with non-string externalId → 400", async () => {
    const env = makeEnv();
    const res = await seedCreds(env, {
      region: "us-east-1",
      roleArn: "arn:aws:iam::1:role/X",
      externalId: 12345,
    });
    expect(res.status).toBe(400);
  });
});

describe("M-004 STS AssumeRole forwards ExternalId", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("stored externalId flows into the STS POST body as ExternalId=<value>", async () => {
    const env = makeEnv();
    const ext = "super-strong-external-id-32";
    await seedCreds(env, {
      region: "us-east-1",
      roleArn: "arn:aws:iam::123:role/PushCI",
      externalId: ext,
    });
    const fetchMock = installAwsRouter(
      () => new Response(AWS_OK_XML, { status: 200 }),
      () => new Response(JSON.stringify({ pipelines: [] }), { status: 200 })
    );
    const res = await callAws(env, "/pipelines", { bearer: await awsToken() });
    expect(res.status).toBe(200);
    const stsCall = fetchMock.mock.calls.find(([u]) =>
      String(u).startsWith("https://sts.amazonaws.com/")
    );
    expect(stsCall).toBeDefined();
    const body = String((stsCall![1] as RequestInit).body);
    expect(body).toContain(`ExternalId=${encodeURIComponent(ext).replace(/%20/g, "+")}`);
  });

  it("auto-generated externalId also flows into the STS call", async () => {
    const env = makeEnv();
    const seedRes = await seedCreds(env, {
      region: "us-east-1",
      roleArn: "arn:aws:iam::123:role/PushCI",
    });
    const seedBody = (await seedRes.json()) as { generatedExternalId: string };
    const ext = seedBody.generatedExternalId;
    const fetchMock = installAwsRouter(
      () => new Response(AWS_OK_XML, { status: 200 }),
      () => new Response(JSON.stringify({ pipelines: [] }), { status: 200 })
    );
    await callAws(env, "/pipelines", { bearer: await awsToken() });
    const stsCall = fetchMock.mock.calls.find(([u]) =>
      String(u).startsWith("https://sts.amazonaws.com/")
    );
    const body = String((stsCall![1] as RequestInit).body);
    expect(body).toContain(`ExternalId=${ext}`);
  });
});

describe("M-004 GET /credentials — externalId redaction", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("shows prefix…suffix redaction like sharedSecret, never full value", async () => {
    const env = makeEnv();
    const ext = "abc123456789defxyz0"; // 19 chars
    await seedCreds(env, {
      region: "us-east-1",
      roleArn: "arn:aws:iam::1:role/X",
      externalId: ext,
    });
    const res = await callAws(env, "/credentials", { bearer: await awsToken() });
    const body = (await res.json()) as {
      credentials: { externalId: string };
    };
    expect(body.credentials.externalId).toBe("abc1…xyz0");
    expect(body.credentials.externalId).not.toBe(ext);
  });
});

