import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  listWorkspaces,
  listRepos,
  listPipelines,
  getPipeline,
  getPipelineSteps,
  triggerPipeline,
  getPipelinesYaml,
  pipelineStatus,
  type BitbucketAuth,
} from "./bitbucket";

type MockCall = { url: string; init?: RequestInit };

function mockFetch(
  responder: (url: string, init?: RequestInit) => { status?: number; body: unknown | string }
) {
  const calls: MockCall[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    const r = responder(url, init);
    const status = r.status ?? 200;
    const body = typeof r.body === "string" ? r.body : JSON.stringify(r.body);
    return new Response(body, { status });
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return { calls, fn };
}

const authBasic: BitbucketAuth = { user: "alice", appPassword: "app-password-xyz" };
const authBearer: BitbucketAuth = { bearer: "bearer-xyz" };

describe("auth headers", () => {
  let calls: MockCall[] = [];
  beforeEach(() => {
    ({ calls } = mockFetch(() => ({ body: { values: [] } })));
  });
  afterEach(() => vi.restoreAllMocks());

  it("uses basic auth when user+appPassword provided", async () => {
    await listWorkspaces(authBasic);
    const hdr = (calls[0].init?.headers as Record<string, string>).Authorization;
    expect(hdr).toMatch(/^Basic /);
    // btoa("alice:app-password-xyz")
    expect(hdr).toBe("Basic " + btoa("alice:app-password-xyz"));
  });

  it("uses bearer auth when bearer provided", async () => {
    await listWorkspaces(authBearer);
    const hdr = (calls[0].init?.headers as Record<string, string>).Authorization;
    expect(hdr).toBe("Bearer bearer-xyz");
  });

  it("throws when no creds are provided", async () => {
    await expect(listWorkspaces({})).rejects.toThrow(/bitbucket auth/);
  });
});

describe("listWorkspaces", () => {
  afterEach(() => vi.restoreAllMocks());
  it("returns workspace slugs", async () => {
    mockFetch(() => ({
      body: { values: [{ slug: "acme", name: "Acme Corp", uuid: "{uuid}" }] },
    }));
    const ws = await listWorkspaces(authBasic);
    expect(ws).toEqual([{ slug: "acme", name: "Acme Corp", uuid: "{uuid}" }]);
  });
});

describe("listRepos", () => {
  afterEach(() => vi.restoreAllMocks());
  it("hits the workspace repos endpoint", async () => {
    const { calls } = mockFetch(() => ({
      body: { values: [{ slug: "api", full_name: "acme/api", name: "api" }] },
    }));
    const repos = await listRepos("acme", authBasic);
    expect(repos[0].full_name).toBe("acme/api");
    expect(calls[0].url).toContain("/repositories/acme");
  });
});

describe("listPipelines + pipelineStatus", () => {
  afterEach(() => vi.restoreAllMocks());
  it("returns sorted recent runs", async () => {
    mockFetch(() => ({
      body: {
        values: [
          {
            uuid: "{1}",
            build_number: 42,
            state: { name: "COMPLETED", result: { name: "SUCCESSFUL" } },
            created_on: "2026-04-17T10:00:00Z",
            target: { ref_name: "main" },
          },
        ],
      },
    }));
    const ps = await listPipelines("acme", "api", authBasic);
    expect(ps).toHaveLength(1);
    expect(pipelineStatus(ps[0])).toBe("passed");
  });

  it("maps every state to a normalized status", () => {
    expect(pipelineStatus({ uuid: "", build_number: 0, state: { name: "IN_PROGRESS" }, created_on: "" })).toBe("running");
    expect(pipelineStatus({ uuid: "", build_number: 0, state: { name: "PENDING" }, created_on: "" })).toBe("pending");
    expect(pipelineStatus({ uuid: "", build_number: 0, state: { name: "STOPPED" }, created_on: "" })).toBe("stopped");
    expect(
      pipelineStatus({ uuid: "", build_number: 0, state: { name: "COMPLETED", result: { name: "FAILED" } }, created_on: "" })
    ).toBe("failed");
    expect(
      pipelineStatus({ uuid: "", build_number: 0, state: { name: "COMPLETED", result: { name: "ERROR" } }, created_on: "" })
    ).toBe("failed");
  });
});

describe("getPipeline + getPipelineSteps", () => {
  afterEach(() => vi.restoreAllMocks());
  it("fetches a single pipeline by uuid", async () => {
    const { calls } = mockFetch(() => ({
      body: { uuid: "{x}", build_number: 7, state: { name: "IN_PROGRESS" }, created_on: "t" },
    }));
    const p = await getPipeline("acme", "api", "{x}", authBasic);
    expect(p.build_number).toBe(7);
    expect(calls[0].url).toContain("/pipelines/%7Bx%7D");
  });

  it("fetches steps as a list", async () => {
    mockFetch(() => ({
      body: {
        values: [
          { uuid: "{s1}", name: "Build", state: { name: "COMPLETED", result: { name: "SUCCESSFUL" } } },
        ],
      },
    }));
    const steps = await getPipelineSteps("acme", "api", "{x}", authBasic);
    expect(steps[0].name).toBe("Build");
  });
});

describe("triggerPipeline", () => {
  afterEach(() => vi.restoreAllMocks());
  it("POSTs a pipeline_ref_target body", async () => {
    const { calls } = mockFetch(() => ({
      status: 201,
      body: { uuid: "{new}", build_number: 99, state: { name: "PENDING" }, created_on: "t" },
    }));
    const p = await triggerPipeline("acme", "api", "develop", authBasic);
    expect(p.build_number).toBe(99);
    const req = calls[0].init!;
    expect(req.method).toBe("POST");
    const body = JSON.parse(req.body as string);
    expect(body.target.ref_type).toBe("branch");
    expect(body.target.ref_name).toBe("develop");
    expect(body.target.type).toBe("pipeline_ref_target");
  });

  it("passes through refType=tag when requested", async () => {
    const { calls } = mockFetch(() => ({
      status: 201,
      body: { uuid: "{t}", build_number: 1, state: { name: "PENDING" }, created_on: "t" },
    }));
    await triggerPipeline("acme", "api", "v1.0.0", authBasic, "tag");
    const body = JSON.parse(calls[0].init!.body as string);
    expect(body.target.ref_type).toBe("tag");
  });
});

describe("getPipelinesYaml", () => {
  afterEach(() => vi.restoreAllMocks());
  it("fetches the raw YAML file", async () => {
    mockFetch(() => ({ body: "image: node:20\npipelines:\n  default:\n    - step:\n        script:\n          - npm test\n" }));
    const yaml = await getPipelinesYaml("acme", "api", "main", authBasic);
    expect(yaml).toContain("npm test");
  });
});

describe("error handling", () => {
  afterEach(() => vi.restoreAllMocks());
  it("throws on non-2xx responses with context", async () => {
    mockFetch(() => ({ status: 401, body: { error: "Unauthorized" } }));
    await expect(listWorkspaces(authBasic)).rejects.toThrow(/bitbucket listWorkspaces failed: 401/);
  });
});
