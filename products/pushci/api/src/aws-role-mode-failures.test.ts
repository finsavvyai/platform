// Failure-mode + validation + redaction tests for AWS Role mode (v1.6.6).
// Pairs with aws-role-mode.test.ts which covers the happy paths.

import { describe, it, expect, afterEach, vi } from "vitest";
import {
  awsToken,
  callAws,
  installAwsRouter,
  makeEnv,
  seedCreds,
} from "./aws-test-helpers";

const originalFetch = globalThis.fetch;

describe("v1.6.6 role mode — failure modes", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("STS 403 → 502 with helpful role-trust hint", async () => {
    const env = makeEnv();
    await seedCreds(env, { region: "us-east-1", roleArn: "arn:aws:iam::123:role/X" });
    installAwsRouter(
      () =>
        new Response(
          `<ErrorResponse><Error><Code>AccessDenied</Code></Error></ErrorResponse>`,
          { status: 403 }
        ),
      () => {
        throw new Error("should not reach CodePipeline");
      }
    );
    const res = await callAws(env, "/pipelines", { bearer: await awsToken() });
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/sts:AssumeRole failed/);
    expect(body.error).toMatch(/trust policy|external ID/i);
  });

  it("STS 400 InvalidClientTokenId surfaces as 502", async () => {
    const env = makeEnv();
    await seedCreds(env, { region: "us-east-1", roleArn: "arn:aws:iam::123:role/X" });
    installAwsRouter(
      () =>
        new Response(
          `<ErrorResponse><Error><Code>InvalidClientTokenId</Code></Error></ErrorResponse>`,
          { status: 400 }
        ),
      () => new Response("{}")
    );
    const res = await callAws(env, "/pipelines", { bearer: await awsToken() });
    expect(res.status).toBe(502);
  });

  it("base STS worker secrets missing → 502 (never leaks CodePipeline call)", async () => {
    const env = makeEnv({
      AWS_STS_ACCESS_KEY_ID: undefined,
      AWS_STS_SECRET_ACCESS_KEY: undefined,
    });
    await seedCreds(env, { region: "us-east-1", roleArn: "arn:aws:iam::123:role/X" });
    const fetchMock = installAwsRouter(
      () => {
        throw new Error("STS must not be called without base secrets");
      },
      () => new Response("{}")
    );
    const res = await callAws(env, "/pipelines", { bearer: await awsToken() });
    expect(res.status).toBe(502);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("network timeout during AssumeRole → 502", async () => {
    const env = makeEnv();
    await seedCreds(env, { region: "us-east-1", roleArn: "arn:aws:iam::123:role/X" });
    installAwsRouter(
      () => {
        throw new Error("ETIMEDOUT");
      },
      () => new Response("{}")
    );
    const res = await callAws(env, "/pipelines", { bearer: await awsToken() });
    expect(res.status).toBe(502);
  });

  it("malformed STS XML (no creds) → 502", async () => {
    const env = makeEnv();
    await seedCreds(env, { region: "us-east-1", roleArn: "arn:aws:iam::123:role/X" });
    installAwsRouter(
      () =>
        new Response(
          `<AssumeRoleResponse><AssumeRoleResult></AssumeRoleResult></AssumeRoleResponse>`,
          { status: 200 }
        ),
      () => new Response("{}")
    );
    const res = await callAws(env, "/pipelines", { bearer: await awsToken() });
    expect(res.status).toBe(502);
  });
});

describe("v1.6.6 credentials API — validation + redaction", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("rejects role mode without roleArn or static keys", async () => {
    const env = makeEnv();
    const res = await seedCreds(env, { region: "us-east-1" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/accessKeyId|roleArn/);
  });

  it("requires region", async () => {
    const env = makeEnv();
    const res = await seedCreds(env, { roleArn: "arn:aws:iam::1:role/X" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/region/);
  });

  it("auto-generates externalId when role mode omits it (M-004 fix)", async () => {
    const env = makeEnv();
    const res = await seedCreds(env, {
      region: "us-east-1",
      roleArn: "arn:aws:iam::1:role/X",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      warnings: string[];
      generatedExternalId: string;
    };
    expect(body.warnings.some((w) => /externalId/i.test(w))).toBe(true);
    expect(body.generatedExternalId).toMatch(/^[0-9a-f]{32}$/);
  });

  it("GET /credentials never leaks session token or secret access key", async () => {
    const env = makeEnv();
    await seedCreds(env, {
      region: "us-east-1",
      roleArn: "arn:aws:iam::123:role/PushCI",
      externalId: "abcdefghijklmnop-xyz9",
    });
    const res = await callAws(env, "/credentials", { bearer: await awsToken() });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("abcdefghijklmnop-xyz9");
    expect(text).not.toContain("tempsession");
    expect(text).not.toContain("basesecret");
    const body = JSON.parse(text) as {
      configured: boolean;
      credentials: { roleArn: string; externalId?: string };
    };
    expect(body.credentials.roleArn).toBe("arn:aws:iam::123:role/PushCI");
    // Redaction is now prefix…suffix style, not "***", for non-empty values.
    expect(body.credentials.externalId).toBe("abcd…xyz9");
  });

  it("unauthorized request → 401", async () => {
    const env = makeEnv();
    const res = await callAws(env, "/pipelines");
    expect(res.status).toBe(401);
  });
});
