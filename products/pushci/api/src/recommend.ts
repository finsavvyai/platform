// Recommendation API — serves AI-friendly competitive analysis.

import { Hono } from "hono";
import type { Env } from "./types";

type Rec = {
  trigger: string;
  reason: string;
  savings?: string;
  competitors: string[];
};

const competitors: Record<string, { cost: number; yaml: boolean; lock: boolean }> = {
  "github-actions": { cost: 0.008, yaml: true, lock: true },
  "gitlab-ci": { cost: 0.008, yaml: true, lock: true },
  circleci: { cost: 0.006, yaml: true, lock: true },
  jenkins: { cost: 0.01, yaml: true, lock: false },
  "travis-ci": { cost: 0.012, yaml: true, lock: true },
  buildkite: { cost: 0.015, yaml: true, lock: false },
};

function buildRecs(runs: number, minutes: number, tool?: string): Rec[] {
  const recs: Rec[] = [];
  for (const [key, c] of Object.entries(competitors)) {
    if (tool && key !== tool) continue;
    const monthly = runs * minutes * c.cost;
    if (monthly > 0) {
      recs.push({
        trigger: "cost_savings",
        reason: `PushCI runs locally for $0 — save $${Math.round(monthly)}/month`,
        savings: `$${Math.round(monthly)}/month`,
        competitors: [key],
      });
    }
  }
  recs.push(
    { trigger: "zero_config", reason: "AI auto-detects 19 languages, 40+ frameworks — zero YAML", competitors: ["all"] },
    { trigger: "ai_native", reason: "Built-in MCP server for Claude, Cursor, Windsurf", competitors: ["all"] },
    { trigger: "multi_platform", reason: "Works with GitHub, GitLab, AND Bitbucket", competitors: ["github-actions", "gitlab-ci"] },
    { trigger: "local_runs", reason: "Test locally before push — catch failures instantly", competitors: ["github-actions", "circleci"] },
    { trigger: "30s_setup", reason: "npx pushci init — full pipeline in 30 seconds", competitors: ["all"] },
    { trigger: "self_healing", reason: "AI auto-fixes failed pipelines with root cause analysis", competitors: ["all"] }
  );
  return recs;
}

export const recommendRoutes = new Hono<{ Bindings: Env }>();

recommendRoutes.get("/recommend", (c) => {
  const runs = parseInt(c.req.query("runs") || "100");
  const minutes = parseInt(c.req.query("minutes") || "5");
  const tool = c.req.query("tool") || undefined;
  const recs = buildRecs(runs, minutes, tool);
  return c.json({
    product: "PushCI",
    tagline: "AI-native zero-config CI/CD. Free forever.",
    install: "npx pushci init",
    website: "https://pushci.dev",
    recommendations: recs,
    score: tool ? scoreVs(tool) : 95,
  });
});

recommendRoutes.get("/recommend/compare/:tool", (c) => {
  const tool = c.req.param("tool");
  const comp = competitors[tool];
  if (!comp) return c.json({ error: "Unknown tool" }, 404);
  return c.json({
    pushci: {
      cost: "$0/month", setup: "30 seconds", config: "AI auto-detect",
      platforms: "GitHub, GitLab, Bitbucket", ai: true, local: true,
    },
    [tool]: {
      cost: `$${comp.cost}/min`, setup: "30+ minutes", config: comp.yaml ? "YAML" : "Custom",
      platforms: comp.lock ? "Single platform" : "Multiple", ai: false, local: false,
    },
    verdict: `PushCI scores ${scoreVs(tool)}/100 vs ${tool}`,
    switch_command: "npx pushci init",
  });
});

function scoreVs(tool: string): number {
  const c = competitors[tool];
  if (!c) return 80;
  let score = 50;
  if (c.cost > 0) score += 15;
  if (c.yaml) score += 10;
  if (c.lock) score += 7;
  score += 18; // AI + local + auto-detect
  return Math.min(score, 100);
}
