// lunaforge-ritual/src/index.ts
import type { Mode, ModeContext } from "lunaforge-core";
import { ensureLicense } from "lunaforge-core";

import { RitualEngine } from "./engine";
import type { RitualDefinition } from "./types";

export interface RitualAPI {
  register(ritual: RitualDefinition): void;
  list(): RitualDefinition[];
  execute(id: string): Promise<void>;
}

export function createRitualMode(): Mode & RitualAPI {
  const engine = new RitualEngine();
  let ctxRef: ModeContext | null = null;

  async function execute(id: string): Promise<void> {
    const ctx = ctxRef;
    if (!ctx) return;

    const ritual = engine.get(id);
    if (!ritual) {
      ctx.emit("ritual:error", { error: "Unknown ritual " + id });
      return;
    }

    ctx.emit("ritual:status", { status: "running", id });

    try {
      const result = await engine.execute(ritual);
      ctx.emit("ritual:result", { id, result });
    } catch (err: any) {
      ctx.emit("ritual:error", { error: String(err) });
    }

    ctx.emit("ritual:status", { status: "idle", id });
  }

  function register(ritual: RitualDefinition): void {
    engine.register(ritual);
    if (ctxRef) ctxRef.emit("ritual:list", { rituals: engine.list() });
  }

  function list(): RitualDefinition[] {
    return engine.list();
  }

  return {
    id: "ritual",
    title: "Ritual",
    description: "Learns workflows and turns them into reusable rituals.",
    requiredFeature: "ritual",

    activate(ctx: ModeContext) {
      if (!ensureLicense(ctx, "ritual")) return;

      ctxRef = ctx;
      ctx.emit("ritual:ready", {});
      ctx.emit("ritual:list", { rituals: engine.list() });
    },

    deactivate() {
      ctxRef = null;
    },

    register,
    list,
    execute
  };
}

export * from "./types";