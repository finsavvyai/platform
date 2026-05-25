/** quality.ts — quality regression scoring for skipped/cached responses. */

import type { ProviderCallResult } from '../baselines/types';

/** Whitespace collapse, JSON key sort if parseable, lowercase. */
export function normalize(text: string): string {
  const t = text.trim();
  // If it parses as JSON, sort keys recursively for stable comparison.
  try {
    const obj = JSON.parse(t);
    return JSON.stringify(sortKeys(obj));
  } catch { /* not JSON, fall through */ }
  return t.replace(/\s+/g, ' ').toLowerCase();
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      o[k] = sortKeys((v as Record<string, unknown>)[k]);
    }
    return o;
  }
  return v;
}

/** Byte-equality after normalization. Used for Buckets A + C. */
export function byteEqual(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

export interface JudgeVerdict {
  judge: string;
  agree: boolean;
  reason: string;
  raw?: string;
  error?: string;
}

const JUDGE_PROMPT = (input: string, ref: string, cand: string) =>
  `You are a strict, unbiased judge.\n\nUser request:\n${input}\n\nResponse A:\n${ref}\n\nResponse B:\n${cand}\n\nDo Response A and Response B give a semantically equivalent answer to the user request? Reply on the FIRST line with exactly one of: AGREE or DISAGREE. On the SECOND line, give a one-sentence justification.`;

async function callJudge(judge: { provider: 'openai' | 'anthropic' | 'google'; model: string }, prompt: string): Promise<{ text: string; raw?: string }> {
  if (judge.provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: judge.model, messages: [{ role: 'user', content: prompt }] }),
    });
    const j = await r.json() as { choices: Array<{ message: { content: string } }> };
    return { text: j.choices[0].message.content };
  }
  if (judge.provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: judge.model, max_tokens: 256, messages: [{ role: 'user', content: prompt }] }),
    });
    const j = await r.json() as { content: Array<{ text: string }> };
    return { text: j.content[0].text };
  }
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${judge.model}:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const j = await r.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
  return { text: j.candidates[0].content.parts[0].text };
}

const JUDGES: Array<{ name: string; provider: 'openai' | 'anthropic' | 'google'; model: string }> = [
  { name: 'gpt-5',           provider: 'openai',    model: 'gpt-5' },
  { name: 'claude-opus-4-7', provider: 'anthropic', model: 'claude-opus-4-7' },
  { name: 'gemini-2.5-pro',  provider: 'google',    model: 'gemini-2.5-pro' },
];

/** Run all three judges in parallel; return per-judge verdicts. */
export async function tripleJudge(input: string, reference: string, candidate: string): Promise<JudgeVerdict[]> {
  const results = await Promise.allSettled(JUDGES.map(async (j) => {
    const out = await callJudge(j, JUDGE_PROMPT(input, reference, candidate));
    const first = (out.text.split('\n')[0] ?? '').trim().toUpperCase();
    const reason = (out.text.split('\n').slice(1).join(' ') ?? '').trim();
    return { judge: j.name, agree: first.startsWith('AGREE'), reason, raw: out.text };
  }));
  return results.map((r, i) => r.status === 'fulfilled' ? r.value : { judge: JUDGES[i].name, agree: false, reason: '', error: (r.reason as Error).message });
}

/** ≥2 of 3 judges DISAGREE = regression. */
export function isRegression(verdicts: JudgeVerdict[]): boolean {
  const disagree = verdicts.filter((v) => !v.agree && !v.error).length;
  return disagree >= 2;
}

/** Quality scoring entry point. Picks byte-equality (A,C) or triple-judge (B) per bucket. */
export async function scoreQuality(
  bucket: 'a' | 'b' | 'c', input: string, reference: ProviderCallResult, candidate: ProviderCallResult,
): Promise<{ regression: boolean; method: 'byte' | 'judge'; verdicts?: JudgeVerdict[] }> {
  if (bucket === 'b') {
    const verdicts = await tripleJudge(input, reference.output, candidate.output);
    return { regression: isRegression(verdicts), method: 'judge', verdicts };
  }
  return { regression: !byteEqual(reference.output, candidate.output), method: 'byte' };
}
