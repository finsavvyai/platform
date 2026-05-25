/** Baseline C — Cloudflare AI Gateway with caching. On-platform comparison. */

import type { Baseline, BenchRequest, ProviderCallResult, ModelChoice } from './types';
import { computeCost } from './types';

/** CF AI Gateway URL: https://gateway.ai.cloudflare.com/v1/{account}/{gateway}/{provider}/<provider-path> */
function cfUrl(provider: string, providerPath: string): string {
  const acct = process.env.CF_ACCOUNT_ID;
  const gw = process.env.CF_AI_GATEWAY_ID;
  if (!acct || !gw) throw new Error('CF_ACCOUNT_ID + CF_AI_GATEWAY_ID required for Baseline C');
  const cfProvider = provider === 'openai' ? 'openai' : provider === 'anthropic' ? 'anthropic' : provider === 'google' ? 'google-ai-studio' : 'deepseek';
  return `https://gateway.ai.cloudflare.com/v1/${acct}/${gw}/${cfProvider}/${providerPath}`;
}

const CACHE_TTL_HEADER = { 'cf-aig-cache-ttl': '3600' };

async function callOpenAI(req: BenchRequest, model: string) {
  const t0 = Date.now();
  const res = await fetch(cfUrl('openai', 'chat/completions'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...CACHE_TTL_HEADER },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: req.prompt }] }),
  });
  const cached = res.headers.get('cf-aig-cache-status') === 'HIT';
  const json = await res.json() as { choices: Array<{ message: { content: string } }>; usage: { prompt_tokens: number; completion_tokens: number } };
  return { text: json.choices[0].message.content, pIn: json.usage?.prompt_tokens ?? 0, pOut: json.usage?.completion_tokens ?? 0, cached, ms: Date.now() - t0 };
}

async function callAnthropic(req: BenchRequest, model: string) {
  const t0 = Date.now();
  const res = await fetch(cfUrl('anthropic', 'v1/messages'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01', ...CACHE_TTL_HEADER },
    body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content: req.prompt }] }),
  });
  const cached = res.headers.get('cf-aig-cache-status') === 'HIT';
  const json = await res.json() as { content: Array<{ text: string }>; usage: { input_tokens: number; output_tokens: number } };
  return { text: json.content[0].text, pIn: json.usage?.input_tokens ?? 0, pOut: json.usage?.output_tokens ?? 0, cached, ms: Date.now() - t0 };
}

async function callGoogle(req: BenchRequest, model: string) {
  const t0 = Date.now();
  const res = await fetch(`${cfUrl('google', `v1/models/${model}:generateContent`)}?key=${process.env.GOOGLE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...CACHE_TTL_HEADER },
    body: JSON.stringify({ contents: [{ parts: [{ text: req.prompt }] }] }),
  });
  const cached = res.headers.get('cf-aig-cache-status') === 'HIT';
  const json = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }>; usageMetadata: { promptTokenCount: number; candidatesTokenCount: number } };
  return { text: json.candidates[0].content.parts[0].text, pIn: json.usageMetadata.promptTokenCount, pOut: json.usageMetadata.candidatesTokenCount, cached, ms: Date.now() - t0 };
}

async function callDeepSeek(req: BenchRequest, model: string) {
  const t0 = Date.now();
  const res = await fetch(cfUrl('deepseek', 'v1/chat/completions'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, ...CACHE_TTL_HEADER },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: req.prompt }] }),
  });
  const cached = res.headers.get('cf-aig-cache-status') === 'HIT';
  const json = await res.json() as { choices: Array<{ message: { content: string } }>; usage: { prompt_tokens: number; completion_tokens: number } };
  return { text: json.choices[0].message.content, pIn: json.usage?.prompt_tokens ?? 0, pOut: json.usage?.completion_tokens ?? 0, cached, ms: Date.now() - t0 };
}

async function dispatch(req: BenchRequest, m: ModelChoice) {
  if (m.provider === 'openai') return callOpenAI(req, m.model);
  if (m.provider === 'anthropic') return callAnthropic(req, m.model);
  if (m.provider === 'google') return callGoogle(req, m.model);
  return callDeepSeek(req, m.model);
}

export const baselineC: Baseline = {
  name: 'C',
  description: 'Cloudflare AI Gateway with caching (cf-aig-cache-ttl=3600).',
  async call(req: BenchRequest, m: ModelChoice): Promise<ProviderCallResult> {
    try {
      const r = await dispatch(req, m);
      // Cache hits cost $0 at the gateway; underlying provider is not billed.
      const cost = r.cached ? 0 : computeCost(m.model, r.pIn, r.pOut, false);
      return {
        baseline: 'C', provider: m.provider, model: m.model,
        prompt_tokens: r.pIn, completion_tokens: r.pOut,
        cost_usd: cost, cached: r.cached, skipped: false, latency_ms: r.ms, output: r.text,
        meta: { cf_cache_status: r.cached ? 'HIT' : 'MISS' },
      };
    } catch (e) {
      return { baseline: 'C', provider: m.provider, model: m.model, prompt_tokens: 0, completion_tokens: 0, cost_usd: 0, cached: false, skipped: false, latency_ms: 0, output: '', error: (e as Error).message };
    }
  },
};
