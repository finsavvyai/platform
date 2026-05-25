// lunaforge-guardian/src/index.ts
import type { EnhancedMode, ModeContext, ProjectGraph } from "lunaforge-core";
import type { GuardianRule, GuardianViolation } from "./types";
import { matchPattern } from "./matcher";
import { ensureLicense } from "lunaforge-core";

export interface GuardianConfig {
  rules: GuardianRule[];
}

export interface GuardianAPI {
  evaluate(graph?: ProjectGraph | null): void;
  setConfig(config: GuardianConfig): void;
}

export function createGuardianMode(initialConfig: GuardianConfig): EnhancedMode & GuardianAPI {
  let ctxRef: ModeContext | null = null;
  let config = initialConfig;

  function setConfig(newConfig: GuardianConfig): void {
    config = newConfig;
    evaluate();
  }

  function evaluate(graphOverride?: ProjectGraph | null): void {
    const ctx = ctxRef;
    if (!ctx) return;

    const graph = graphOverride ?? ctx.graph;
    if (!graph) {
      ctx.emit("guardian:error", { error: "No project graph available" });
      return;
    }

    const violations = evaluateGraph(graph, config.rules);

    ctx.emit("guardian:summary", {
      violationCount: violations.length
    });

    if (violations.length > 0) {
      ctx.emit("guardian:violations", { violations });
    }
  }

  return {
    id: "guardian",
    title: "Guardian",
    description: "Real-time architecture firewall that flags boundary violations.",
    version: "0.2.0",
    author: "LunaForge",
    tags: ["architecture", "lint", "firewall"],
    priority: 5,
    requiredFeature: "guardian",

    async activate(ctx: ModeContext) {
      if (!ensureLicense(ctx, "guardian")) return;

      ctxRef = ctx;
      ctx.emit("guardian:ready", {});
      evaluate();
    },

    async deactivate() {
      ctxRef = null;
    },

    async onGraphUpdate(ctx: ModeContext, graph: ProjectGraph) {
      ctxRef = ctx;
      evaluate(graph);
    },

    evaluate,
    setConfig
  };
}

export function evaluateGraph(
  graph: ProjectGraph,
  rules: GuardianRule[]
): GuardianViolation[] {
  const violations: GuardianViolation[] = [];

  for (const dep of graph.dependencies) {
    const { from, to } = dep;

    for (const rule of rules) {
      const fromMatch = matchPattern(rule.fromPattern, from);
      const toMatch = matchPattern(rule.toPattern, to);

      if (!fromMatch || !toMatch) continue;

      if (rule.effect === "deny") {
        violations.push({
          ruleId: rule.id,
          from,
          to,
          message: `Forbidden dependency from "${from}" to "${to}" by rule "${rule.name}"`
        });
      }
    }
  }

  return violations;
}

export * from "./types";