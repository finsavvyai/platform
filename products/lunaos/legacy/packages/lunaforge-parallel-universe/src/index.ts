import type { Mode, ModeContext, ModeClientOptions } from "lunaforge-core";
import { ensureLicense } from "lunaforge-core";

import { UniverseClient } from "./client";
import type { UniverseRequest } from "./types";

export interface ParallelUniverseAPI {
  translate(req: UniverseRequest): Promise<void>;
}

export function createParallelUniverseMode(
  opts: ModeClientOptions
): Mode & ParallelUniverseAPI {
  const client = new UniverseClient({
    baseUrl: opts.baseUrl || opts.workerUrl || "",
    apiKey: opts.apiKey
  });
  let ctxRef: ModeContext | null = null;

  async function translate(req: UniverseRequest): Promise<void> {
    const ctx = ctxRef;
    if (!ctx) return;

    // Optional per-call gating
    if (!ensureLicense(ctx, "parallel-universe")) return;

    ctx.emit("parallel-universe:status", { status: "processing" });

    try {
      const out = await client.translate(req);
      ctx.emit("parallel-universe:result", { result: out });
    } catch (err: any) {
      ctx.emit("parallel-universe:error", { error: String(err) });
    }

    ctx.emit("parallel-universe:status", { status: "idle" });
  }

  return {
    id: "parallel-universe",
    title: "Parallel Universe",
    description:
      "Generate alternate-language versions of any code file via backend AI.",
    requiredFeature: "parallel-universe",

    activate(ctx: ModeContext) {
      if (!ensureLicense(ctx, "parallel-universe")) return;

      ctxRef = ctx;
      ctx.emit("parallel-universe:ready", {});
    },

    deactivate() {
      ctxRef = null;
    },

    translate
  };
}

export * from "./types";