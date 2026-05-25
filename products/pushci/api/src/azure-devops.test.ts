// Azure DevOps client tests — mocks global fetch.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  listProjects,
  listPipelines,
  listRuns,
  getRun,
  getPipeline,
  runPipeline,
  azureStatus,
  trimBaseUrl,
} from "./azure-devops";

const AUTH = { pat: "tok123" };

function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const fn = vi.fn(async (input: RequestInfo, init: RequestInit = {}) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    return handler(url, init);
  });
  (globalThis as any).fetch = fn;
  return fn;
}

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("azureStatus mapping", () => {
  it("maps inProgress → running", () => {
    expect(azureStatus("inProgress")).toBe("running");
  });
  it("maps completed+succeeded → passed", () => {
    expect(azureStatus("completed", "succeeded")).toBe("passed");
  });
  it("maps completed+partiallySucceeded → passed", () => {
    expect(azureStatus("completed", "partiallySucceeded")).toBe("passed");
  });
  it("maps completed+failed → failed", () => {
    expect(azureStatus("completed", "failed")).toBe("failed");
  });
  it("maps completed+canceled → stopped", () => {
    expect(azureStatus("completed", "canceled")).toBe("stopped");
  });
  it("maps canceling → stopped", () => {
    expect(azureStatus("canceling")).toBe("stopped");
  });
  it("maps notStarted → pending", () => {
    expect(azureStatus("notStarted")).toBe("pending");
  });
  it("defaults to unknown", () => {
    expect(azureStatus()).toBe("unknown");
    expect(azureStatus("completed")).toBe("unknown");
  });
});

describe("trimBaseUrl", () => {
  it("extracts org from full dev.azure.com URL", () => {
    expect(trimBaseUrl("https://dev.azure.com/contoso/")).toBe("contoso");
  });
  it("passes through bare org name", () => {
    expect(trimBaseUrl("contoso")).toBe("contoso");
  });
  it("strips trailing slashes", () => {
    expect(trimBaseUrl("contoso//")).toBe("contoso");
  });
});

describe("listProjects", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends basic auth with empty user and PAT password", async () => {
    const fn = mockFetch(() => jsonRes({ value: [{ id: "p1", name: "proj" }] }));
    await listProjects("contoso", AUTH);
    const call = fn.mock.calls[0];
    const headers = call[1]!.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Basic " + btoa(":tok123"));
    expect(call[0]).toContain("dev.azure.com/contoso/_apis/projects");
    expect(call[0]).toContain("api-version=7.0");
  });

  it("returns the value array", async () => {
    mockFetch(() => jsonRes({ value: [{ id: "p1", name: "proj" }] }));
    const projects = await listProjects("contoso", AUTH);
    expect(projects).toEqual([{ id: "p1", name: "proj" }]);
  });

  it("throws on non-2xx", async () => {
    mockFetch(() => new Response("boom", { status: 403 }));
    await expect(listProjects("contoso", AUTH)).rejects.toThrow(/403/);
  });

  it("accepts bearer auth as an alternative", async () => {
    const fn = mockFetch(() => jsonRes({ value: [] }));
    await listProjects("contoso", { bearer: "oauth-xyz" });
    const headers = fn.mock.calls[0][1]!.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer oauth-xyz");
  });
});

describe("listPipelines / listRuns / getRun / getPipeline", () => {
  afterEach(() => vi.restoreAllMocks());

  it("listPipelines encodes project in path", async () => {
    const fn = mockFetch(() => jsonRes({ value: [{ id: 1, name: "pipe" }] }));
    await listPipelines("contoso", "my proj", AUTH);
    expect(fn.mock.calls[0][0]).toContain("my%20proj/_apis/pipelines");
  });

  it("listRuns returns the run list", async () => {
    mockFetch(() =>
      jsonRes({
        value: [
          { id: 10, state: "completed", result: "succeeded" },
          { id: 11, state: "inProgress" },
        ],
      })
    );
    const runs = await listRuns("contoso", "proj", 1, AUTH);
    expect(runs).toHaveLength(2);
    expect(runs[0].id).toBe(10);
  });

  it("getRun fetches a single run", async () => {
    mockFetch(() => jsonRes({ id: 42, state: "completed", result: "failed" }));
    const run = await getRun("contoso", "proj", 1, 42, AUTH);
    expect(run.state).toBe("completed");
    expect(run.result).toBe("failed");
  });

  it("getPipeline passes includeDefinition=true", async () => {
    const fn = mockFetch(() => jsonRes({ id: 1, name: "pipe" }));
    await getPipeline("contoso", "proj", 1, AUTH);
    expect(fn.mock.calls[0][0]).toContain("includeDefinition=true");
  });
});

describe("runPipeline", () => {
  afterEach(() => vi.restoreAllMocks());

  it("POSTs with JSON resources block when refName is set", async () => {
    const fn = mockFetch(() => jsonRes({ id: 99, state: "notStarted" }));
    const run = await runPipeline(
      "contoso",
      "proj",
      7,
      { refName: "refs/heads/main" },
      AUTH
    );
    const init = fn.mock.calls[0][1]!;
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.resources.repositories.self.refName).toBe("refs/heads/main");
    expect(run.id).toBe(99);
  });

  it("omits variables when empty", async () => {
    const fn = mockFetch(() => jsonRes({ id: 1, state: "notStarted" }));
    await runPipeline("contoso", "proj", 7, {}, AUTH);
    const body = JSON.parse(fn.mock.calls[0][1]!.body as string);
    expect(body.variables).toBeUndefined();
  });

  it("passes through variables when provided", async () => {
    const fn = mockFetch(() => jsonRes({ id: 1, state: "notStarted" }));
    await runPipeline(
      "contoso",
      "proj",
      7,
      { variables: { FOO: { value: "bar" } } },
      AUTH
    );
    const body = JSON.parse(fn.mock.calls[0][1]!.body as string);
    expect(body.variables.FOO.value).toBe("bar");
  });
});
