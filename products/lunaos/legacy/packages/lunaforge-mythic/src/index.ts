import type { Mode, ModeContext, ModeClientOptions } from "lunaforge-core";
import { ensureLicense } from "lunaforge-core";

import type { MythicStory, MythicModelOutput } from "./types";
import { MythicBackendClient } from "./backendClient";

export interface MythicAPI {
  generate(story: MythicStory): Promise<void>;
}

export function createMythicMode(
  opts: ModeClientOptions
): Mode & MythicAPI {
  const client = new MythicBackendClient({
    baseUrl: (opts as any).baseUrl,
    workerUrl: (opts as any).workerUrl,
    apiKey: (opts as any).apiKey
  });

  let ctxRef: ModeContext | null = null;

  async function run(story: MythicStory): Promise<void> {
    const ctx = ctxRef;
    if (!ctx) return;

    if (!ensureLicense(ctx, "mythic")) return;

    ctx.emit("mythic:status", { status: "processing" });

    try {
      const output: MythicModelOutput = await client.generate(story);
      ctx.emit("mythic:result", output);
    } catch (err) {
      ctx.emit("mythic:error", { error: String(err) });
    }

    ctx.emit("mythic:status", { status: "idle" });
  }

  return {
    id: "mythic",
    title: "Mythic",
    description:
      "Transforms narrative stories into architecture and code scaffolding via AI backend.",
    requiredFeature: "mythic",

    activate(ctx: ModeContext) {
      // Needed by generic-mode.test.ts
      if (!ensureLicense(ctx, "mythic")) {
        ctx.emit("mythic:license-error", {
          feature: "mythic",
          message: "License required for Mythic mode"
        });
        return;
      }

      ctxRef = ctx;
      ctx.emit("mythic:ready", {});
    },

    deactivate() {
      ctxRef = null;
    },

    async generate(story: MythicStory) {
      await run(story);
    }
  };
}

export * from "./types";