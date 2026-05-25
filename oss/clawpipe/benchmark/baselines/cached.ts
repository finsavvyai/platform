/** Baseline B — provider with prompt caching enabled. The real comparison. */

import type { Baseline, BenchRequest, ProviderCallResult, ModelChoice } from './types';
import { computeCost } from './types';

const SYSTEM_PROMPT = 'You are a concise, accurate assistant. Answer in the format the user requests.';

/** Anthropic prompt caching: mark the system block with cache_control. */
async function callAnthropicCached(req: BenchRequest, model: string): Promise<{ text: string; pIn: number; pOut: number; cachedIn: number; ms: number }> {
  const t0 = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model, max_tokens: 1024,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: req.prompt }],
    }),
  });
  const json = await res.json() as { content: Array<{ text: string }>; usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } };
  const cachedIn = json.usage.cache_read_input_tokens ?? 0;
  return { text: json.content[0].text, pIn: json.usage.input_tokens, pOut: json.usage.output_tokens, cachedIn, ms: Date.now() - t0 };
}

/** OpenAI prompt caching: stable prefix + prompt_cache_key. */
async function callOpenAICached(req: BenchRequest, model: string): Promise<{ text: string; pIn: number; pOut: number; cachedIn: number; ms: number }> {
  const t0 = Date.now();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: req.prompt },
      ],
      prompt_cache_key: `bench-${req.bucket}`,
    }),
  });
  const json = await res.json() as { choices: Array<{ message: { content: string } }>; usage: { prompt_tokens: number; completion_tokens: number; prompt_tokens_details?: { cached_tokens?: number } } };
  const cachedIn = json.usage.prompt_tokens_details?.cached_tokens ?? 0;
  return { text: json.choices[0].message.content, pIn: json.usage.prompt_tokens, pOut: json.usage.completion_tokens, cachedIn, ms: Date.now() - t0 };
}

/** DeepSeek auto-caches prefixes; usage reports cache hit tokens. */
async function callDeepSeekCached(req: BenchRequest, model: string): Promise<{ text: string; pIn: number; pOut: number; cachedIn: number; ms: number }> {
  const t0 = Date.now();
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: req.prompt }],
    }),
  });
  const json = await res.json() as { choices: Array<{ message: { content: string } }>; usage: { prompt_tokens: number; completion_tokens: number; prompt_cache_hit_tokens?: number } };
  const cachedIn = json.usage.prompt_cache_hit_tokens ?? 0;
  return { text: json.choices[0].message.content, pIn: json.usage.prompt_tokens, pOut: json.usage.completion_tokens, cachedIn, ms: Date.now() - t0 };
}

/** Google Gemini does not expose prompt caching for short single-turn calls; fall back to raw with the system prefix.
 *  Gemini has implicit caching only at very long context lengths, irrelevant for benchmark prompts. */
async function callGoogleCached(req: BenchRequest, model: string): Promise<{ text: string; pIn: number; pOut: number; cachedIn: number; ms: number }> {
  const t0 = Date.now();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: req.prompt }] }],
    }),
  });
  const json = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }>; usageMetadata: { promptTokenCount: number; candidatesTokenCount: number; cachedContentTokenCount?: number } };
  return { text: json.candidates[0].content.parts[0].text, pIn: json.usageMetadata.promptTokenCount, pOut: json.usageMetadata.candidatesTokenCount, cachedIn: json.usageMetadata.cachedContentTokenCount ?? 0, ms: Date.now() - t0 };
}

async function dispatch(req: BenchRequest, m: ModelChoice) {
  if (m.provider === 'anthropic') return callAnthropicCached(req, m.model);
  if (m.provider === 'openai') return callOpenAICached(req, m.model);
  if (m.provider === 'deepseek') return callDeepSeekCached(req, m.model);
  return callGoogleCached(req, m.model);
}

export const baselineB: Baseline = {
  name: 'B',
  description: 'Provider with prompt caching enabled. Anthropic cache_control / OpenAI prompt_cache_key / DeepSeek auto-cache.',
  async call(req: BenchRequest, m: ModelChoice): Promise<ProviderCallResult> {
    try {
      const r = await dispatch(req, m);
      const uncachedIn = Math.max(0, r.pIn - r.cachedIn);
      const uncachedCost = computeCost(m.model, uncachedIn, r.pOut, false);
      const cachedCost = r.cachedIn > 0 ? computeCost(m.model, r.cachedIn, 0, true) : 0;
      return {
        baseline: 'B', provider: m.provider, model: m.model,
        prompt_tokens: r.pIn, completion_tokens: r.pOut,
        cost_usd: uncachedCost + cachedCost,
        cached: r.cachedIn > 0, skipped: false, latency_ms: r.ms, output: r.text,
        meta: { cached_input_tokens: r.cachedIn },
      };
    } catch (e) {
      return { baseline: 'B', provider: m.provider, model: m.model, prompt_tokens: 0, completion_tokens: 0, cost_usd: 0, cached: false, skipped: false, latency_ms: 0, output: '', error: (e as Error).message };
    }
  },
};
