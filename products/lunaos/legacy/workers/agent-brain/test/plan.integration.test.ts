import { describe, it, expect } from "vitest";
import { Miniflare } from "miniflare";
import path from "node:path";

describe("Agent Brain Worker - /v1/plan", () => {
  it("returns a plan for workspace target", async () => {
    const mf = new Miniflare({
      scriptPath: path.join(__dirname, "../dist/index.js"),
      modules: true,
      bindings: {
        LUNAFORGE_MYTHIC_PROVIDERS: "anthropic,openai",
        OPENAI_API_BASE: "https://api.openai.com/v1"
      }
    });

    const res = await mf.dispatchFetch("http://localhost/v1/plan", {
      method: "POST",
      body: JSON.stringify({
        target: "workspace",
        summary: "Analyze my project"
      })
    });

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.plan).toBeDefined();
    expect(json.plan.steps?.length).toBeGreaterThan(0);
  });
});