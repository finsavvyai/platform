import type { EnhancedMode, ModeContext, ProjectGraph } from "lunaforge-core";
import { ensureLicense } from "lunaforge-core";

export interface GalaxyAPI {
  open(): Promise<void>;
}

export function createGalaxyMode(): EnhancedMode & GalaxyAPI {
  let ctxRef: ModeContext | null = null;

  async function open(graphOverride?: ProjectGraph): Promise<void> {
    const ctx = ctxRef;
    if (!ctx) return;

    const graph = graphOverride ?? ctx.graph;
    if (!graph) {
      ctx.emit("galaxy:error", { error: "No graph available yet." });
      return;
    }

    ctx.emit("galaxy:data", {
      nodes: graph.files.map((f) => ({
        id: f.path,
        label: f.path.split("/").pop(),
        size: f.size ?? 1
      })),
      edges: graph.dependencies.map((d) => ({
        from: d.from,
        to: d.to
      }))
    });
  }

  return {
    id: "galaxy",
    title: "Galaxy View",
    description: "Visualize your project as a cosmic constellation of files and dependencies.",
    version: "0.2.0",
    author: "LunaForge",
    tags: ["visualization", "graph"],
    priority: 10,
    requiredFeature: "galaxy",

    async activate(ctx: ModeContext) {
      if (!ensureLicense(ctx, "galaxy")) return;
      ctxRef = ctx;
      ctx.emit("galaxy:ready", {});
    },

    async deactivate() {
      ctxRef = null;
    },

    async onGraphUpdate(ctx: ModeContext, graph: ProjectGraph) {
      ctxRef = ctx;
      await open(graph);
    },

    open
  };
}

export * from "./types";