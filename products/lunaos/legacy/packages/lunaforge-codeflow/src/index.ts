import type {
  Mode,
  ModeContext,
  ProjectGraph,
  ModeClientOptions
} from "lunaforge-core";

import { ensureLicense } from "lunaforge-core";
import type { CodeFlowRequest, CodeFlowPath, CodeFlowStep } from "./types";

export interface CodeFlowAPI {
  analyze(
    req: CodeFlowRequest,
    graphOverride?: ProjectGraph | null
  ): void;
}

export function createCodeFlowMode(
  opts?: ModeClientOptions
): Mode & CodeFlowAPI {
  let ctxRef: ModeContext | null = null;

  function analyze(
    req: CodeFlowRequest,
    graphOverride?: ProjectGraph | null
  ): void {
    const ctx = ctxRef;
    if (!ctx) return;

    const graph = graphOverride ?? ctx.graph;
    if (!graph) {
      ctx.emit("codeflow:error", { error: "No project graph available" });
      return;
    }

    const path = buildFlow(graph, req);
    ctx.emit("codeflow:path", { request: req, path });
  }

  return {
    id: "codeflow",
    title: "CodeFlow",
    description:
      "High-level visualizer for call paths, imports, and data flows.",
    requiredFeature: "codeflow",

    activate(ctx: ModeContext) {
      if (!ensureLicense(ctx, "codeflow")) return;
      ctxRef = ctx;
      ctx.emit("codeflow:ready", {});
    },

    deactivate() {
      ctxRef = null;
    },

    analyze
  };
}

/** Breadth-first import/call path walk */
function buildFlow(graph: ProjectGraph, req: CodeFlowRequest): CodeFlowPath {
  const visited = new Set<string>();
  const steps: CodeFlowStep[] = [];
  const queue: string[] = [req.entryFile];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;

    visited.add(current);

    for (const dep of graph.dependencies) {
      if (dep.from === current) {
        steps.push({
          from: dep.from,
          to: dep.to,
          kind: "import"
        });

        if (!visited.has(dep.to)) queue.push(dep.to);
      }
    }
  }

  return { steps };
}

export * from "./types";