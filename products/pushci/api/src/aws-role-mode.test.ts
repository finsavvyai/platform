// E2E integration tests for AWS Role-mode (AssumeRole → CodePipeline).
// Shipped in v1.6.6. STS calls are distinguished from CodePipeline calls
// by URL and answered with separate responders.
//
// Covers: happy path (role + static) and the route-integration surface.
// Failure modes live in aws-role-mode-failures.test.ts.

import { describe, it, expect, afterEach, vi } from "vitest";
import {
  AWS_OK_XML,
  AWS_SUB,
  awsToken,
  callAws,
  installAwsRouter,
  makeEnv,
  seedCreds,
} from "./aws-test-helpers";

const originalFetch = globalThis.fetch;

describe("v1.6.6 role mode — happy path end-to-end", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("stores role creds, assumes role, then signs ListPipelines with temp creds", async () => {
    const env = makeEnv();
    const seedRes = await seedCreds(env, {
      region: "us-east-1",
      roleArn: "arn:aws:iam::123:role/PushCI",
      externalId: "ext-1-sixteen-char-min",
    });
    expect(seedRes.status).toBe(200);
    const fetchMock = installAwsRouter(
      () => new Response(AWS_OK_XML, { status: 200 }),
      () =>
        new Response(JSON.stringify({ pipelines: [{ name: "deploy-prod" }] }), {
          status: 200,
          headers: { "content-type": "application/x-amz-json-1.1" },
        })
    );
    const res = await callAws(env, "/pipelines", { bearer: await awsToken() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      pipelines: { name: string }[];
    };
    expect(body.ok).toBe(true);
    expect(body.pipelines[0].name).toBe("deploy-prod");
    // 1 STS + 1 CodePipeline.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const cpCall = fetchMock.mock.calls.find(([u]) =>
      String(u).startsWith("https://codepipeline.")
    );
    expect(cpCall).toBeDefined();
    const cpHeaders = (cpCall![1] as RequestInit).headers as Record<string, string>;
    // Temp session token must flow into the CodePipeline signed request.
    expect(cpHeaders["x-amz-security-token"]).toBe("tempsession");
    expect(cpHeaders["authorization"]).toContain("ASIATEMP/");
  });

  it("StartPipelineExecution (trigger) uses temp creds", async () => {
    const env = makeEnv();
    await seedCreds(env, {
      region: "us-east-1",
      roleArn: "arn:aws:iam::123:role/PushCI",
    });
    const fetchMock = installAwsRouter(
      () => new Response(AWS_OK_XML, { status: 200 }),
      () =>
        new Response(JSON.stringify({ pipelineExecutionId: "exec-abc" }), {
          status: 200,
        })
    );
    const res = await callAws(env, "/pipelines/deploy-prod/trigger", {
      method: "POST",
      bearer: await awsToken(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; execution_id: string };
    expect(body.execution_id).toBe("exec-abc");
    const cpCall = fetchMock.mock.calls.find(([u]) =>
      String(u).startsWith("https://codepipeline.")
    );
    const cpHeaders = (cpCall![1] as RequestInit).headers as Record<string, string>;
    expect(cpHeaders["x-amz-target"]).toBe(
      "CodePipeline_20150709.StartPipelineExecution"
    );
    expect(cpHeaders["x-amz-security-token"]).toBe("tempsession");
  });
});

describe("v1.6.6 static mode — no STS regression", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("static creds skip STS entirely", async () => {
    const env = makeEnv();
    await seedCreds(env, {
      region: "us-east-1",
      accessKeyId: "AKIASTATIC",
      secretAccessKey: "staticsecret",
    });
    const fetchMock = installAwsRouter(
      () => {
        throw new Error("STS must not be called in static mode");
      },
      () => new Response(JSON.stringify({ pipelines: [] }), { status: 200 })
    );
    const res = await callAws(env, "/pipelines", { bearer: await awsToken() });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const cpHeaders = (fetchMock.mock.calls[0][1] as RequestInit)
      .headers as Record<string, string>;
    expect(cpHeaders["authorization"]).toContain("AKIASTATIC/");
    expect(cpHeaders["x-amz-security-token"]).toBeUndefined();
  });
});

describe("v1.6.6 credential lifetime + KV persistence", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("stored role-mode creds never persist a session token in KV", async () => {
    const env = makeEnv();
    await seedCreds(env, {
      region: "us-east-1",
      roleArn: "arn:aws:iam::1:role/X",
    });
    installAwsRouter(
      () => new Response(AWS_OK_XML),
      () => new Response(JSON.stringify({ pipelines: [] }))
    );
    await callAws(env, "/pipelines", { bearer: await awsToken() });
    const raw = await env.RUNNERS.get(`aws:creds:${AWS_SUB}`);
    expect(raw).not.toBeNull();
    expect(raw!).not.toContain("tempsession");
    expect(raw!).not.toContain("ASIATEMP");
  });

  it("calls STS fresh on every route invocation (no in-memory reuse)", async () => {
    const env = makeEnv();
    await seedCreds(env, {
      region: "us-east-1",
      roleArn: "arn:aws:iam::1:role/X",
    });
    const fetchMock = installAwsRouter(
      () => new Response(AWS_OK_XML),
      () => new Response(JSON.stringify({ pipelines: [] }))
    );
    await callAws(env, "/pipelines", { bearer: await awsToken() });
    await callAws(env, "/pipelines", { bearer: await awsToken() });
    const stsCalls = fetchMock.mock.calls.filter(([u]) =>
      String(u).startsWith("https://sts.")
    );
    expect(stsCalls).toHaveLength(2);
  });
});
