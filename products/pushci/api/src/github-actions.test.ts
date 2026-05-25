// Tests for the GitHub Actions bridge client + status normaliser.
// Stubs globalThis.fetch — no real api.github.com traffic.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  listRepos, listWorkflows, listRuns, getRun, listJobs,
  dispatchWorkflow, rerunRun, cancelRun,
} from "./github-actions-client";
import { githubStatusToPushCI } from "./github-actions-status";

const auth = { token: "ghp_test_secret" };
const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}
function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

describe("githubStatusToPushCI", () => {
  it("maps conclusion=success → passed", () => {
    expect(githubStatusToPushCI("completed", "success")).toBe("passed");
    expect(githubStatusToPushCI("completed", "skipped")).toBe("passed");
    expect(githubStatusToPushCI("completed", "neutral")).toBe("passed");
  });

  it("maps failure-like conclusions → failed", () => {
    expect(githubStatusToPushCI("completed", "failure")).toBe("failed");
    expect(githubStatusToPushCI("completed", "timed_out")).toBe("failed");
    expect(githubStatusToPushCI("completed", "startup_failure")).toBe("failed");
    expect(githubStatusToPushCI("completed", "action_required")).toBe("failed");
  });

  it("maps cancelled/stale → stopped", () => {
    expect(githubStatusToPushCI("completed", "cancelled")).toBe("stopped");
    expect(githubStatusToPushCI("completed", "stale")).toBe("stopped");
  });

  it("maps lifecycle states without a conclusion", () => {
    expect(githubStatusToPushCI("in_progress", null)).toBe("running");
    expect(githubStatusToPushCI("queued", null)).toBe("pending");
    expect(githubStatusToPushCI("waiting", null)).toBe("pending");
    expect(githubStatusToPushCI("requested", null)).toBe("pending");
    expect(githubStatusToPushCI("pending", null)).toBe("pending");
  });

  it("returns unknown on empty/unrecognised input", () => {
    expect(githubStatusToPushCI(undefined, undefined)).toBe("unknown");
    expect(githubStatusToPushCI(null, null)).toBe("unknown");
    expect(githubStatusToPushCI("weird", null)).toBe("unknown");
    expect(githubStatusToPushCI("completed", "weird")).toBe("unknown");
  });
});

describe("GitHub Actions client HTTP calls", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("listRepos sends Bearer + api-version headers and parses array", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        { id: 1, name: "x", full_name: "o/x", private: false, default_branch: "main",
          html_url: "https://github.com/o/x", owner: { login: "o" } },
      ])
    );
    const repos = await listRepos(auth);
    expect(repos).toHaveLength(1);
    expect(repos[0].full_name).toBe("o/x");
    const [[url, init]] = fetchMock.mock.calls;
    expect(url).toContain("/user/repos");
    const h = init.headers as Record<string, string>;
    expect(h.Authorization).toBe("Bearer ghp_test_secret");
    expect(h.Accept).toBe("application/vnd.github+json");
    expect(h["X-GitHub-Api-Version"]).toBe("2022-11-28");
  });

  it("listRepos filters client-side when `search` is provided", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        { id: 1, name: "alpha", full_name: "o/alpha", private: false, default_branch: "main",
          html_url: "", owner: { login: "o" } },
        { id: 2, name: "beta",  full_name: "o/beta",  private: false, default_branch: "main",
          html_url: "", owner: { login: "o" } },
      ])
    );
    const repos = await listRepos(auth, { search: "BETA" });
    expect(repos).toHaveLength(1);
    expect(repos[0].full_name).toBe("o/beta");
  });

  it("listWorkflows unwraps `workflows` array", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        workflows: [{
          id: 99, node_id: "n", name: "CI", path: ".github/workflows/ci.yml",
          state: "active", html_url: "", badge_url: "",
          created_at: "2026-04-17T00:00:00Z", updated_at: "2026-04-17T00:00:00Z",
        }],
      })
    );
    const wfs = await listWorkflows("o", "x", auth);
    expect(wfs[0].id).toBe(99);
    const [[url]] = fetchMock.mock.calls;
    expect(url).toContain("/repos/o/x/actions/workflows");
  });

  it("listRuns appends workflowId + branch query params", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ workflow_runs: [] }));
    await listRuns("o", "x", auth, { workflowId: 99, branch: "main" });
    const [[url]] = fetchMock.mock.calls;
    expect(url).toContain("/repos/o/x/actions/workflows/99/runs");
    expect(url).toContain("branch=main");
  });

  it("getRun returns the raw run object", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: 12, run_number: 3, event: "push",
        status: "in_progress", conclusion: null,
        workflow_id: 99, head_branch: "main", head_sha: "abc",
        html_url: "", created_at: "2026-04-17T00:00:00Z",
        updated_at: "2026-04-17T00:00:00Z",
      })
    );
    const run = await getRun("o", "x", 12, auth);
    expect(run.status).toBe("in_progress");
  });

  it("listJobs unwraps `jobs` array", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        jobs: [{
          id: 1, run_id: 12, name: "build",
          status: "completed", conclusion: "success",
          started_at: "2026-04-17T00:00:00Z",
          completed_at: "2026-04-17T00:01:00Z", html_url: "",
        }],
      })
    );
    const jobs = await listJobs("o", "x", 12, auth);
    expect(jobs[0].conclusion).toBe("success");
  });

  it("dispatchWorkflow POSTs JSON body with ref + inputs", async () => {
    fetchMock.mockResolvedValue(emptyResponse(204));
    const res = await dispatchWorkflow(
      "o", "x", 99, { ref: "main", inputs: { env: "prod" } }, auth
    );
    expect(res.ok).toBe(true);
    const [[url, init]] = fetchMock.mock.calls;
    expect(url).toContain("/workflows/99/dispatches");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body.ref).toBe("main");
    expect(body.inputs.env).toBe("prod");
  });

  it("rerunRun accepts 201 without throwing", async () => {
    fetchMock.mockResolvedValue(emptyResponse(201));
    await expect(rerunRun("o", "x", 12, auth)).resolves.toEqual({ ok: true });
  });

  it("cancelRun accepts 202 without throwing", async () => {
    fetchMock.mockResolvedValue(emptyResponse(202));
    await expect(cancelRun("o", "x", 12, auth)).resolves.toEqual({ ok: true });
  });

  it("throws a useful error when GitHub returns a non-2xx", async () => {
    fetchMock.mockResolvedValue(new Response("bad credentials", { status: 401 }));
    await expect(getRun("o", "x", 12, auth)).rejects.toThrow(/github .* 401/);
  });

  it("dispatchWorkflow surfaces non-204 errors", async () => {
    fetchMock.mockResolvedValue(new Response("missing ref", { status: 422 }));
    await expect(
      dispatchWorkflow("o", "x", 99, { ref: "nope" }, auth)
    ).rejects.toThrow(/github .* 422/);
  });
});
