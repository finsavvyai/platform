import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  listProjects,
  listPipelines,
  getPipeline,
  listPipelineJobs,
  triggerPipeline,
  getRawFile,
  gitlabStatusToRunStatus,
} from "./gitlab";

const auth = { privateToken: "test-token-abc" };
const baseUrl = "https://gitlab.example.com";

type FetchSpy = ReturnType<typeof vi.fn>;
let fetchSpy: FetchSpy;

function mockJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
function mockText(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain" } });
}

beforeEach(() => {
  fetchSpy = vi.fn();
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("gitlabStatusToRunStatus", () => {
  it("maps success → passed", () => {
    expect(gitlabStatusToRunStatus("success")).toBe("passed");
  });
  it("maps failed → failed", () => {
    expect(gitlabStatusToRunStatus("failed")).toBe("failed");
  });
  it("maps canceled/skipped → cancelled", () => {
    expect(gitlabStatusToRunStatus("canceled")).toBe("cancelled");
    expect(gitlabStatusToRunStatus("skipped")).toBe("cancelled");
  });
  it("maps running/preparing → running", () => {
    expect(gitlabStatusToRunStatus("running")).toBe("running");
    expect(gitlabStatusToRunStatus("preparing")).toBe("running");
  });
  it("maps pending-like → pending", () => {
    expect(gitlabStatusToRunStatus("pending")).toBe("pending");
    expect(gitlabStatusToRunStatus("manual")).toBe("pending");
    expect(gitlabStatusToRunStatus("scheduled")).toBe("pending");
  });
  it("falls back to unknown", () => {
    expect(gitlabStatusToRunStatus(undefined)).toBe("unknown");
    expect(gitlabStatusToRunStatus("wat")).toBe("unknown");
  });
});

describe("listProjects", () => {
  it("hits /api/v4/projects with PRIVATE-TOKEN header and membership=true", async () => {
    fetchSpy.mockResolvedValueOnce(mockJson([{ id: 1, name: "a", path_with_namespace: "g/a", web_url: "u" }]));
    const out = await listProjects(baseUrl, auth);
    expect(out).toHaveLength(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/api/v4/projects");
    expect(String(url)).toContain("membership=true");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["PRIVATE-TOKEN"]).toBe("test-token-abc");
  });

  it("throws a useful error when status is not ok", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("nope", { status: 401 }));
    await expect(listProjects(baseUrl, auth)).rejects.toThrow(/gitlab listProjects failed: 401/);
  });

  it("passes search when provided", async () => {
    fetchSpy.mockResolvedValueOnce(mockJson([]));
    await listProjects(baseUrl, auth, { search: "foo" });
    expect(String(fetchSpy.mock.calls[0][0])).toContain("search=foo");
  });
});

describe("listPipelines / getPipeline / listPipelineJobs", () => {
  it("requests per_page and optional ref on listPipelines", async () => {
    fetchSpy.mockResolvedValueOnce(mockJson([{ id: 7, project_id: 1, status: "success", ref: "main", sha: "a", web_url: "u", created_at: "", updated_at: "" }]));
    const out = await listPipelines(baseUrl, 42, auth, { ref: "main", perPage: 5 });
    expect(out[0].id).toBe(7);
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("/projects/42/pipelines");
    expect(url).toContain("per_page=5");
    expect(url).toContain("ref=main");
  });

  it("getPipeline encodes project and pipeline ids", async () => {
    fetchSpy.mockResolvedValueOnce(mockJson({ id: 9, project_id: 1, status: "running", ref: "b", sha: "c", web_url: "u", created_at: "", updated_at: "" }));
    const out = await getPipeline(baseUrl, "g/h", 9, auth);
    expect(out.status).toBe("running");
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/projects/g%2Fh/pipelines/9");
  });

  it("listPipelineJobs returns job records", async () => {
    fetchSpy.mockResolvedValueOnce(mockJson([{ id: 1, name: "test", stage: "test", status: "success", ref: "main", created_at: "", web_url: "u" }]));
    const out = await listPipelineJobs(baseUrl, 1, 2, auth);
    expect(out[0].name).toBe("test");
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/pipelines/2/jobs");
  });
});

describe("triggerPipeline", () => {
  it("POSTs JSON body with ref + variables", async () => {
    fetchSpy.mockResolvedValueOnce(mockJson({ id: 100, project_id: 1, status: "pending", ref: "dev", sha: "x", web_url: "u", created_at: "", updated_at: "" }, 201));
    const out = await triggerPipeline(baseUrl, 1, "dev", auth, { FOO: "bar" });
    expect(out.id).toBe(100);
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body.ref).toBe("dev");
    expect(body.variables).toEqual([{ key: "FOO", value: "bar" }]);
  });

  it("throws when GitLab rejects", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("bad ref", { status: 400 }));
    await expect(triggerPipeline(baseUrl, 1, "nope", auth)).rejects.toThrow(/triggerPipeline/);
  });
});

describe("getRawFile", () => {
  it("fetches /repository/files/<path>/raw?ref=<ref>", async () => {
    fetchSpy.mockResolvedValueOnce(mockText("stages:\n- test\n"));
    const out = await getRawFile(baseUrl, 1, ".gitlab-ci.yml", "main", auth);
    expect(out).toContain("stages");
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/repository/files/.gitlab-ci.yml/raw?ref=main");
  });
});
