/** Streaming handler for /v1/stream — SSE with Last-Event-ID resume. */
import type { Env, PromptRequest } from './types';
import { getApiKey } from './providers/registry';
import { wrapStream, parseLastEventId, SSE_HEADERS } from './stream-sse';

const STREAM_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  deepseek: 'https://api.deepseek.com/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  mistral: 'https://api.mistral.ai/v1/chat/completions',
};

export async function handleStream(request: Request, env: Env, projectId?: string): Promise<Response> {
  let body: PromptRequest;
  try { body = await request.json() as PromptRequest; }
  catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const apiKey = await getApiKey(body.provider, env, projectId);
  if (!apiKey) return Response.json({ error: `Provider ${body.provider} not configured` }, { status: 503 });
  const providerUrl = STREAM_URLS[body.provider];
  if (!providerUrl) return Response.json({ error: 'Streaming not supported for this provider' }, { status: 400 });
  const messages: Array<{ role: string; content: string }> = [];
  if (body.system) messages.push({ role: 'system', content: body.system });
  messages.push({ role: 'user', content: body.prompt });
  const providerRes = await fetch(providerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...(body.provider === 'anthropic' ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } : {}),
    },
    body: JSON.stringify({
      model: body.model, messages, stream: true,
      max_tokens: body.maxTokens ?? 4096, temperature: body.temperature ?? 0.7,
    }),
  });
  if (!providerRes.ok || !providerRes.body) return Response.json({ error: 'Stream failed' }, { status: 502 });
  const startAfter = parseLastEventId(request.headers.get('Last-Event-ID'));
  return new Response(wrapStream(providerRes.body, startAfter), { headers: SSE_HEADERS });
}
