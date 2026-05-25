import type { Env, TfPlan } from '../types.js';

/**
 * Build variant ID -> plan mapping from environment variables.
 * Maps LemonSqueezy variant IDs to TokenForge plan names.
 */
export function buildVariantMap(
  env: Env,
): Record<number, TfPlan> {
  const map: Record<number, TfPlan> = {};

  if (env.TF_LS_VARIANT_PRO) {
    map[parseInt(env.TF_LS_VARIANT_PRO, 10)] = 'pro';
  }
  if (env.TF_LS_VARIANT_TEAM) {
    map[parseInt(env.TF_LS_VARIANT_TEAM, 10)] = 'team';
  }
  if (env.TF_LS_VARIANT_ENTERPRISE) {
    map[parseInt(env.TF_LS_VARIANT_ENTERPRISE, 10)] = 'enterprise';
  }

  return map;
}
