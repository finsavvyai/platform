import type {
  Mode,
  ModeContext,
  ModeClientOptions
} from "lunaforge-core";

import { WorkerClient } from "lunaforge-core";
import { createModeLifecycle } from "lunaforge-core";
import type { AutopsyInput } from "./types";

export interface AutopsyAPI {
  analyze(input: AutopsyInput): Promise<void>;
  analyzeFromContext(): Promise<void>;
}

export function createAutopsyMode(
  opts: ModeClientOptions
): Mode & AutopsyAPI {

  // Use baseUrl or workerUrl
  const client = new WorkerClient({
    baseUrl: opts.baseUrl || opts.workerUrl || ""
  });

  // Shared lifecycle (fixes license tests)
  const lifecycle = createModeLifecycle({
    id: "autopsy",
    requiredFeature: "autopsy",

    onActivate(ctx: ModeContext) {
      ctx.emit("autopsy:ready", {});
    },

    onDeactivate() {
      /* no-op for now */
    }
  });

  // Shared ctx access
  function getCtx(): ModeContext | null {
    return lifecycle.getContext();
  }

  async function runAnalysis(input: AutopsyInput): Promise<void> {
    const ctx = getCtx();
    if (!ctx) return;

    ctx.emit("autopsy:status", { status: "analyzing" });

    try {
      const report = await client.call("autopsy.analyze", input);
      ctx.emit("autopsy:report", { report });
    } catch (err: any) {
      ctx.emit("autopsy:error", { error: String(err) });
    }

    ctx.emit("autopsy:status", { status: "idle" });
  }

  return {
    id: "autopsy",
    title: "Autopsy",
    description:
      "Forensic analysis of errors, crashes, logs, and runtime anomalies.",
    requiredFeature: "autopsy",

    activate: lifecycle.activate,
    deactivate: lifecycle.deactivate,

    analyze(input) {
      return runAnalysis(input);
    },

    async analyzeFromContext(): Promise<void> {
      const ctx = getCtx();
      if (!ctx) return;

      const logs: string[] = (ctx as any).recentRuntimeLogs ?? [];
      return runAnalysis({ logs });
    }
  };
}

export * from "./types";