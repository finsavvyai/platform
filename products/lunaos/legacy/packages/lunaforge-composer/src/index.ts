import type { Mode, ModeContext } from "lunaforge-core";
import { ensureLicense } from "lunaforge-core";

import type {
  OrchestraSnapshot,
  ServiceNode,
  ServiceLink,
  RuntimePulse
} from "./types";

export interface ComposerAPI {
  snapshot(): void;
  pushRuntimePulses(pulses: RuntimePulse[]): void;
}

export function createComposerMode(): Mode & ComposerAPI {
  let ctxRef: ModeContext | null = null;

  function snapshot(): void {
    const ctx = ctxRef;
    if (!ctx) return;

    const services: ServiceNode[] = (ctx as any).services ?? [];
    const links: ServiceLink[] = (ctx as any).serviceLinks ?? [];
    const pulses: RuntimePulse[] = (ctx as any).servicePulses ?? [];

    const snap: OrchestraSnapshot = { nodes: services, links, pulses };
    ctx.emit("composer:snapshot", { snapshot: snap });
  }

  function pushRuntimePulses(pulses: RuntimePulse[]): void {
    const ctx = ctxRef;
    if (!ctx) return;
    ctx.emit("composer:pulses", { pulses });
  }

  return {
    id: "composer",
    title: "Composer",
    description:
      "Visual runtime orchestra for services, databases, queues, and event flows.",
    requiredFeature: "composer",

    activate(ctx: ModeContext) {
      if (!ensureLicense(ctx, "composer")) return;

      ctxRef = ctx;
      ctx.emit("composer:ready", {});
    },

    deactivate() {
      ctxRef = null;
    },

    snapshot,
    pushRuntimePulses
  };
}

export * from "./types";