/** Baseline A — raw provider calls, no caching. The easy comparison. */

import type { Baseline, BenchRequest, ProviderCallResult, ModelChoice } from './types';
import { computeCost } from './types';

async function callOpenAI(prompt: string, model: string): Promise<{ text: string; pIn: number; pOut: number; ms: number }> {
  const t0 = Date.now();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
  });
  const json = await res.json() as { choices: Array<{ message: { content: string } }>; usage: { prompt_tokens: number; completion_tokens: number } };
  return { text: json.choices[0].message.content, pIn: json.usage.prompt_tokens, pOut: json.usage.completion_tokens, ms: Date.now() - t0 };
}

async function callAnthropic(prompt: string, model: string): Promise<{ text: string; pIn: number; pOut: number; ms: number }> {
  const t0 = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
  });
  const json = await res.json() as { content: Array<{ text: string }>; usage: { input_tokens: number; output_tokens: number } };
  return { text: json.content[0].text, pIn: json.usage.input_tokens, pOut: json.usage.output_tokens, ms: Date.now() - t0 };
}

async function callGoogle(prompt: string, model: string): Promise<{ text: string; pIn: number; pOut: number; ms: number }> {
  const t0 = Date.now();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const json = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }>; usageMetadata: { promptTokenCount: number; candidatesTokenCount: number } };
  return { text: json.candidates[0].content.parts[0].text, pIn: json.usageMetadata.promptTokenCount, pOut: json.usageMetadata.candidatesTokenCount, ms: Date.now() - t0 };
}

async function callDeepSeek(prompt: string, model: string): Promise<{ text: string; pIn: number; pOut: number; ms: number }> {
  const t0 = Date.now();
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
  });
  const json = await res.json() as { choices: Array<{ message: { content: string } }>; usage: { prompt_tokens: number; completion_tokens: number } };
  return { text: json.choices[0].message.content, pIn: json.usage.prompt_tokens, pOut: json.usage.completion_tokens, ms: Date.now() - t0 };
}

async function dispatch(prompt: string, m: ModelChoice) {
  if (m.provider === 'openai') return callOpenAI(prompt, m.model);
  if (m.provider === 'anthropic') return callAnthropic(prompt, m.model);
  if (m.provider === 'google') return callGoogle(prompt, m.model);
  return callDeepSeek(prompt, m.model);
}

export const baselineA: Baseline = {
  name: 'A',
  description: 'Raw provider calls, no caching. Easy comparison kept for context.',
  async call(req: BenchRequest, m: ModelChoice): Promise<ProviderCallResult> {
    try {
      const r = await dispatch(req.prompt, m);
      return {
        baseline: 'A', provider: m.provider, model: m.model,
        prompt_tokens: r.pIn, completion_tokens: r.pOut,
        cost_usd: computeCost(m.model, r.pIn, r.pOut, false),
        cached: false, skipped: false, latency_ms: r.ms, output: r.text,
      };
    } catch (e) {
      return { baseline: 'A', provider: m.provider, model: m.model, prompt_tokens: 0, completion_tokens: 0, cost_usd: 0, cached: false, skipped: false, latency_ms: 0, output: '', error: (e as Error).message };
    }
  },
};
