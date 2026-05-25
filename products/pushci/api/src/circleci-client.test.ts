// Tests for the CircleCI API v2 client. Stubs globalThis.fetch — no real HTTP.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  listCollaborations,
  listPipelines,
  getPipeline,
  getPipelineWorkflows,
  triggerPipeline,
  circleCIStatusToPushCI,
} from "./circleci-client";

const auth = { apiToken: "ccitok_test" };
const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("circleCIStatusToPushCI", () => {
  it("maps success/failed/error/canceled", () => {
    expect(circleCIStatusToPushCI("success")).toBe("passed");
    expect(circleCIStatusToPushCI("failed")).toBe("failed");
    expect(circleCIStatusToPushCI("error")).toBe("failed");
    expect(circleCIStatusToPushCI("failing")).toBe("failed");
    expect(circleCIStatusToPushCI("canceled")).toBe("stopped");
  });

  it("maps running/on_hold to running, not_run/pending to pending", () => {
    expect(circleCIStatusToPushCI("running")).toBe("running");
    expect(circleCIStatusToPushCI("on_hold")).toBe("running");
    expect(circleCIStatusToPushCI("not_run")).toBe("pending");
    expect(circleCIStatusToPushCI("pending")).toBe("pending");
    expect(circleCIStatusToPushCI("created")).toBe("pending");
  });

  it("returns unknown on empty/unrecognised input", () => {
    expect(circleCIStatusToPushCI(undefined)).toBe("unknown");
    expect(circleCIStatusToPushCI(null)).toBe("unknown");
    expect(circleCIStatusToPushCI("weird")).toBe("unknown");
  });
});

describe("CircleCI client HTTP calls", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("listCollaborations sends Circle-Token and parses the array", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([{ slug: "gh/org", name: "org", vcs_type: "github" }])
    );
    const collabs = await listCollaborations(auth);
    expect(collabs).toHaveLength(1);
    expect(collabs[0].slug).toBe("gh/org");
    const [[url, init]] = fetchMock.mock.calls;
    expect(url).toContain("/me/collaborations");
    expect((init.headers as Record<string, string>)["Circle-Token"]).toBe("ccitok_test");
  });

  it("listPipelines URL-encodes the slug and includes branch query", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [], next_page_token: undefined }));
    await listPipelines("gh/my org/repo", auth, { branch: "main" });
    const [[url]] = fetchMock.mock.calls;
    // Spaces in the org segment must be encoded, but the '/' separators preserved.
    expect(url).toContain("/project/gh/my%20org/repo/pipeline");
    expect(url).toContain("branch=main");
  });

  it("getPipeline parses the pipeline object", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: "pipe-1",
        number: 42,
        project_slug: "gh/org/repo",
        state: "created",
        created_at: "2026-04-17T00:00:00Z",
      })
    );
    const p = await getPipeline("pipe-1", auth);
    expect(p.number).toBe(42);
    expect(p.project_slug).toBe("gh/org/repo");
  });

  it("getPipelineWorkflows unwraps the items array", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        items: [
          {
            id: "wf-1",
            name: "build",
            pipeline_id: "pipe-1",
            project_slug: "gh/org/repo",
            status: "success",
            created_at: "2026-04-17T00:00:00Z",
          },
        ],
      })
    );
    const wfs = await getPipelineWorkflows("pipe-1", auth);
    expect(wfs).toHaveLength(1);
    expect(wfs[0].status).toBe("success");
  });

  it("triggerPipeline POSTs JSON body with branch + parameters", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { id: "pipe-2", number: 43, state: "pending", created_at: "2026-04-17T00:00:00Z" },
        201
      )
    );
    const trig = await triggerPipeline(
      "gh/org/repo",
      { branch: "feature/x", parameters: { run_e2e: true } },
      auth
    );
    expect(trig.id).toBe("pipe-2");
    const [[url, init]] = fetchMock.mock.calls;
    expect(url).toMatch(/\/project\/gh\/org\/repo\/pipeline$/);
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body.branch).toBe("feature/x");
    expect(body.parameters.run_e2e).toBe(true);
  });

  it("throws a useful error when CircleCI returns a non-2xx", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 401 }));
    await expect(getPipeline("pipe-x", auth)).rejects.toThrow(/circleci .* 401/);
  });
});
