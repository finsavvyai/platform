/**
 * LLM Caller — routes through Claw Gateway when configured,
 * falls back to direct provider calls.
 */

import { redactPII } from './pii-redactor';
import { callViaGatewayStream, isGatewayConfigured, type ClawEnv } from './claw-gateway';

const BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
};

export async function callLLM(
  provider: string,
  model: string,
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  temperature = 0.3,
  env?: ClawEnv,
): Promise<Response> {
  const safeSystemPrompt = redactPII(systemPrompt);
  const safeUserMessage = redactPII(userMessage);
  const guardedMessage = `[USER_INPUT_START]\n${safeUserMessage}\n[USER_INPUT_END]`;

  // Route through Claw Gateway if configured
  if (env && isGatewayConfigured(env)) {
    return callViaGatewayStream(env, safeSystemPrompt, guardedMessage, provider, model);
  }

  // Direct provider fallback
  if (provider === 'anthropic') {
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model, max_tokens: 8192, temperature,
        system: safeSystemPrompt,
        messages: [{ role: 'user', content: guardedMessage }],
        stream: true,
      }),
    });
  }

  const url = BASE_URLS[provider] || BASE_URLS.openai;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model, max_tokens: 8192, temperature,
      messages: [
        { role: 'system', content: safeSystemPrompt },
        { role: 'user', content: guardedMessage },
      ],
      stream: true,
    }),
  });
}

export function parseSSEToken(
  data: string,
  provider: string,
): string {
  try {
    const parsed = JSON.parse(data);
    if (provider === 'anthropic') {
      if (parsed.type === 'content_block_delta') {
        return parsed.delta?.text || '';
      }
      return '';
    }
    return parsed.choices?.[0]?.delta?.content || '';
  } catch {
    return '';
  }
}
