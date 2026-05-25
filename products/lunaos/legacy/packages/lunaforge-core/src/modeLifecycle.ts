import { ensureLicense } from "./utils/license";
import type { ModeContext, Mode } from "./types";

export interface ModeLifecycleOptions {
  id: string;
  requiredFeature: string;
  onActivate?: (ctx: ModeContext) => void;
  onDeactivate?: () => void;
}

/**
 * Shared lifecycle behavior for all modes.
 */
export function createModeLifecycle(opts: ModeLifecycleOptions) {
  let ctxRef: ModeContext | null = null;

  return {
    activate(ctx: ModeContext) {
      if (!ensureLicense(ctx, opts.requiredFeature)) {
        ctx.emit(`${opts.id}:license-error`, {
          feature: opts.requiredFeature,
          message: `License required for ${opts.id}`
        });
        return;
      }

      ctxRef = ctx;
      opts.onActivate?.(ctx);
      ctx.emit(`${opts.id}:ready`, {});
    },

    deactivate() {
      ctxRef = null;
      opts.onDeactivate?.();
    },

    getContext() {
      return ctxRef;
    }
  };
}