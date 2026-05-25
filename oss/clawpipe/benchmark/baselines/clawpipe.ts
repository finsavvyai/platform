/** Baseline D — ClawPipe (Booster + cache + routing). The product under test. */

import type { Baseline, BenchRequest, ProviderCallResult, ModelChoice } from './types';
import { computeCost } from './types';

const GATEWAY = process.env.CLAWPIPE_GATEWAY_URL ?? 'https://api.clawpipe.ai';
const API_KEY = process.env.CLAWPIPE_API_KEY ?? '';
const PROJECT_ID = process.env.CLAWPIPE_PROJECT_ID ?? '';

interface PipeResp {
  text: string;
  meta: {
    booster?: { resolved: boolean; rule_id?: string };
    cache?: { hit: boolean; kind?: 'hash' | 'semantic' };
    router?: { provider: string; model: string };
    usage?: { prompt_tokens: number; completion_tokens: number };
    latency_ms: number;
  };
}

export const baselineD: Baseline = {
  name: 'D',
  description: 'ClawPipe gateway: Booster -> Cache -> Router -> Provider, OpenAI-compatible response shape via /v1/prompt.',
  async call(req: BenchRequest, m: ModelChoice): Promise<ProviderCallResult> {
    if (!API_KEY || !PROJECT_ID) {
      return {
        baseline: 'D', provider: m.provider, model: m.model,
        prompt_tokens: 0, completion_tokens: 0, cost_usd: 0,
        cached: false, skipped: false, latency_ms: 0, output: '',
        error: 'CLAWPIPE_API_KEY + CLAWPIPE_PROJECT_ID required',
      };
    }
    const t0 = Date.now();
    try {
      const res = await fetch(`${GATEWAY}/v1/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
          'X-Project-Id': PROJECT_ID,
        },
        body: JSON.stringify({
          prompt: req.prompt,
          provider: m.provider,
          model: m.model,
          // Pin booster/cache on; router will respect the explicit model selection.
          options: { booster: true, cache: true, router: false },
        }),
      });
      const json = await res.json() as PipeResp;
      const skipped = json.meta?.booster?.resolved === true;
      const cached = json.meta?.cache?.hit === true;
      const pIn = json.meta?.usage?.prompt_tokens ?? 0;
      const pOut = json.meta?.usage?.completion_tokens ?? 0;
      const cost = (skipped || cached) ? 0 : computeCost(m.model, pIn, pOut, false);
      return {
        baseline: 'D', provider: m.provider, model: m.model,
        prompt_tokens: pIn, completion_tokens: pOut,
        cost_usd: cost,
        cached, skipped,
        latency_ms: json.meta?.latency_ms ?? Date.now() - t0,
        output: json.text ?? '',
        meta: {
          booster_rule: json.meta?.booster?.rule_id,
          cache_kind: json.meta?.cache?.kind,
          router_choice: json.meta?.router,
        },
      };
    } catch (e) {
      return { baseline: 'D', provider: m.provider, model: m.model, prompt_tokens: 0, completion_tokens: 0, cost_usd: 0, cached: false, skipped: false, latency_ms: Date.now() - t0, output: '', error: (e as Error).message };
    }
  },
};
