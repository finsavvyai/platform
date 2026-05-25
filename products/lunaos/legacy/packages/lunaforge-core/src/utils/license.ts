import type { ModeContext } from "../types";

export function ensureLicense(
  ctx: ModeContext | null,
  feature: string
): boolean {
  const f = ctx?.license?.features || [];
  if (!f.includes(feature)) {
    ctx?.emit?.("license:error", { feature, reason: "Feature not licensed" });
    ctx?.showUpgradePrompt?.(feature);
    return false;
  }
  return true;
}