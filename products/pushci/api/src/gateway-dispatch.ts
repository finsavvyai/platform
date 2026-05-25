// Gateway Dispatch — routes skill execution to OpenSyber, LunaOS, or local.

import type { Env } from "./types";

export interface GatewayTarget {
  name: string;
  url: string;
  authHeader: string;
  authValue: string;
}

const GATEWAYS: Record<string, (env: Env) => GatewayTarget | null> = {
  opensyber: (env) => env.OPENSYBER_GATEWAY_TOKEN ? {
    name: "OpenSyber",
    url: "https://opensyber-api.broad-dew-49ad.workers.dev/api/agent",
    authHeader: "X-Gateway-Token",
    authValue: env.OPENSYBER_GATEWAY_TOKEN,
  } : null,
  lunaos: (env) => env.LUNAOS_API_TOKEN ? {
    name: "LunaOS",
    url: "https://api.lunaos.ai/openclaw",
    authHeader: "Authorization",
    authValue: `Bearer ${env.LUNAOS_API_TOKEN}`,
  } : null,
  pushci: (env) => env.ANTHROPIC_API_KEY ? {
    name: "PushCI Local",
    url: "https://api.pushci.dev/api/nlp/ask",
    authHeader: "Authorization",
    authValue: `Bearer internal`,
  } : null,
};

export function getAvailableGateways(env: Env): GatewayTarget[] {
  return Object.values(GATEWAYS)
    .map(fn => fn(env))
    .filter((g): g is GatewayTarget => g !== null);
}

export async function dispatchToGateway(
  env: Env,
  gateway: string,
  command: string,
  context?: Record<string, string>
): Promise<{ ok: boolean; gateway: string; response?: string; error?: string }> {
  const target = GATEWAYS[gateway]?.(env);
  if (!target) return { ok: false, gateway, error: `Gateway "${gateway}" not configured` };

  try {
    const res = await fetch(`${target.url}/dispatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [target.authHeader]: target.authValue,
      },
      body: JSON.stringify({ command, context: context || {} }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, gateway: target.name, error: `${res.status}: ${text.slice(0, 200)}` };
    }

    const data = await res.json() as Record<string, unknown>;
    return { ok: true, gateway: target.name, response: JSON.stringify(data) };
  } catch (err) {
    return { ok: false, gateway: target.name, error: err instanceof Error ? err.message : "dispatch failed" };
  }
}

export async function dispatchSkillSteps(
  env: Env,
  steps: Array<{ name: string; run: string }>,
  gateway?: string
): Promise<Array<{ step: string; ok: boolean; output: string }>> {
  const results: Array<{ step: string; ok: boolean; output: string }> = [];

  for (const step of steps) {
    if (gateway && gateway !== "local") {
      const result = await dispatchToGateway(env, gateway, step.run);
      results.push({ step: step.name, ok: result.ok, output: result.response || result.error || "" });
      if (!result.ok) break;
    } else {
      // Local execution — just record the command
      results.push({ step: step.name, ok: true, output: `Command: ${step.run}` });
    }
  }

  return results;
}
