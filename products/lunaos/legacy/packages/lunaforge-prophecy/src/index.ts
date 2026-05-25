import type { Mode, ModeClientOptions, ModeContext } from "lunaforge-core";
import { ensureLicense } from "lunaforge-core";

import { ProphecyClient } from "./client";
import type { ProphecyInput } from "./types";

export interface ProphecyAPI {
  generate(input: ProphecyInput): Promise<void>;
}

export function createProphecyMode(
  opts: ModeClientOptions
): Mode & ProphecyAPI {
  const client = new ProphecyClient({
    baseUrl: opts.baseUrl || opts.workerUrl || "",
    apiKey: opts.apiKey
  });
  let ctxRef: ModeContext | null = null;

  return {
    id: "prophecy",
    title: "Prophecy",
    description: "Predictive architectural guidance and blueprint generation.",
    requiredFeature: "prophecy",

    activate(ctx: ModeContext) {
      if (!ensureLicense(ctx, "prophecy")) return;

      ctxRef = ctx;
      ctx.emit("prophecy:ready", {});
    },

    deactivate() {
      ctxRef = null;
    },

    async generate(input: ProphecyInput): Promise<void> {
      if (!ctxRef) return;

      ctxRef.emit("prophecy:status", { status: "working" });

      try {
        const result = await client.generate(input);
        ctxRef.emit("prophecy:result", { result });
      } catch (err: any) {
        ctxRef.emit("prophecy:error", { error: String(err) });
      }

      ctxRef.emit("prophecy:status", { status: "idle" });
    }
  };
}