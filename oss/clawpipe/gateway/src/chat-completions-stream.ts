/** SSE streaming for POST /v1/chat/completions when stream:true.
 *
 * If the upstream provider supports streaming, we pass through its SSE and
 * re-emit in OpenAI chunk format. If not, we call the adapter normally and
 * emit a single chunk + DONE.
 */

import type { Env, PromptRequest } from './types';
import { withProviderTimeout } from './rate-limit';
import { getAdapter } from './providers/registry';

const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
};

/** Provider URLs that natively support SSE streaming. */
const STREAM_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  mistral: 'https://api.mistral.ai/v1/chat/completions',
};

function chunkEvent(id: string, model: string, content: string): string {
  const data = JSON.stringify({
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta: { content }, finish_reason: null }],
  });
  return `data: ${data}\n\n`;
}

function doneEvent(): string { return 'data: [DONE]\n\n'; }

/** Stream from a provider that natively speaks OpenAI SSE. */
async function streamFromProvider(
  req: PromptRequest,
  providerUrl: string,
  apiKey: string,
  model: string,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const messages: Array<{ role: string; content: string }> = [];
  if (req.system) messages.push({ role: 'system', content: req.system });
  messages.push({ role: 'user', content: req.prompt });

  const providerRes = await fetch(providerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model: req.model,
      messages,
      stream: true,
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature ?? 0.7,
    }),
  });

  if (!providerRes.ok || !providerRes.body) {
    const err = await providerRes.text().catch(() => 'unknown');
    throw new Error(`Provider stream error ${providerRes.status}: ${err.slice(0, 200)}`);
  }

  return new Response(providerRes.body, { headers: SSE_HEADERS });
}

/** Fall back: call adapter synchronously, emit one chunk + DONE. */
async function streamFallback(
  req: PromptRequest,
  provider: string,
  apiKey: string,
  model: string,
  env: Env,
): Promise<Response> {
  const adapter = getAdapter(provider);
  if (!adapter) throw new Error(`No adapter for provider: ${provider}`);

  const result = await withProviderTimeout(adapter.call(req, apiKey));
  const id = `chatcmpl-${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  const body = chunkEvent(id, model, result.text) + doneEvent();

  return new Response(body, { headers: SSE_HEADERS });
}

/** Entry point — called from handleChatCompletions when stream:true. */
export async function streamChatCompletions(
  req: PromptRequest,
  provider: string,
  apiKey: string,
  model: string,
  env: Env,
): Promise<Response> {
  try {
    const providerUrl = STREAM_URLS[provider];
    if (providerUrl) {
      return await streamFromProvider(req, providerUrl, apiKey, model);
    }
    return await streamFallback(req, provider, apiKey, model, env);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stream error';
    return Response.json({ error: message }, { status: 502 });
  }
}
