/** POST /v1/chat/completions — OpenAI drop-in proxy.
 *
 * Accepts the unmodified OpenAI SDK request shape. Runs booster / cache /
 * router pipeline, dispatches to the selected provider, and returns an
 * OpenAI-shaped response so callers need only set OPENAI_BASE_URL.
 */

import type { Env, PromptRequest } from './types';
import { getAdapter, getApiKey } from './providers/registry';
import { isWithinLimits } from './billing/usage';
import { getBudgetStatus, getProjectTeamId, getTeamBudgetStatus, getTeamRateLimit } from './budget';
import { withProviderTimeout } from './rate-limit';

export interface OAIMessage { role: string; content: string }

export interface ChatCompletionsBody {
  model: string;
  messages: OAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  user?: string;
  tools?: unknown[];
  response_format?: unknown;
}

/** Map a model name prefix to a provider slug. */
export function routeModelToProvider(model: string): string {
  if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')) return 'openai';
  if (model.startsWith('claude-')) return 'anthropic';
  if (model.startsWith('deepseek-')) return 'deepseek';
  if (model.startsWith('gemini-')) return 'gemini';
  if (model.startsWith('mistral-') || model.startsWith('mixtral-')) return 'mistral';
  if (model.startsWith('llama') || model.startsWith('meta-llama')) return 'groq';
  // fallback: try openai
  return 'openai';
}

/** Build an OpenAI-shaped chat.completion response object. */
export function buildOAIResponse(
  model: string,
  content: string,
  promptTokens: number,
  completionTokens: number,
): Record<string, unknown> {
  return {
    id: `chatcmpl-${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
}

/** Extract a single system string + user prompt from messages array. */
function extractPromptParts(messages: OAIMessage[]): { system?: string; prompt: string } {
  const systemMsgs = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const nonSystem = messages.filter((m) => m.role !== 'system');
  const prompt = nonSystem.map((m) => `${m.role}: ${m.content}`).join('\n');
  return { system: systemMsgs.length > 0 ? systemMsgs.join('\n') : undefined, prompt };
}

export async function handleChatCompletions(
  request: Request,
  env: Env,
  projectId: string,
): Promise<Response> {
  let body: ChatCompletionsBody;
  try { body = await request.json() as ChatCompletionsBody; }
  catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  if (!body.model || !Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: 'Missing required fields: model, messages' }, { status: 400 });
  }

  if (!(await isWithinLimits(env, projectId))) {
    return Response.json({ error: 'Daily quota exceeded for this project' }, { status: 429 });
  }

  const budget = await getBudgetStatus(env, projectId);
  if (budget.over) {
    return Response.json({ error: 'Monthly budget exceeded for this project', budget }, { status: 402 });
  }

  const teamId = await getProjectTeamId(env, projectId);
  if (teamId) {
    const teamBudget = await getTeamBudgetStatus(env, teamId);
    if (teamBudget.over) {
      return Response.json({ error: 'Monthly budget exceeded for this team', teamBudget }, { status: 402 });
    }
    const teamRate = await getTeamRateLimit(env, teamId);
    if (teamRate.over) {
      return Response.json({ error: 'Daily team quota exceeded', teamRate }, { status: 429 });
    }
  }

  const provider = routeModelToProvider(body.model);
  const adapter = getAdapter(provider);
  if (!adapter) return Response.json({ error: `No adapter for provider: ${provider}` }, { status: 400 });
  const apiKey = getApiKey(provider, env);
  if (!apiKey) return Response.json({ error: `Provider ${provider} not configured` }, { status: 503 });

  const { system, prompt } = extractPromptParts(body.messages);
  const req: PromptRequest = {
    prompt,
    provider,
    model: body.model,
    system,
    maxTokens: body.max_tokens,
    temperature: body.temperature,
  };

  if (body.stream) {
    const { streamChatCompletions } = await import('./chat-completions-stream');
    return streamChatCompletions(req, provider, apiKey, body.model, env);
  }

  try {
    const result = await withProviderTimeout(adapter.call(req, apiKey));
    await logChatRequest(env, projectId, body.model, provider, result.tokensIn, result.tokensOut, result.latencyMs);
    return Response.json(buildOAIResponse(body.model, result.text, result.tokensIn, result.tokensOut));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Provider error';
    return Response.json({ error: message }, { status: 502 });
  }
}

async function logChatRequest(
  env: Env, projectId: string, model: string, provider: string,
  tokensIn: number, tokensOut: number, latencyMs: number,
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO requests (id, project_id, prompt_hash, provider, model, tokens_in, tokens_out, latency_ms, cached, boosted, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, datetime('now'))`,
    ).bind(
      crypto.randomUUID(), projectId, 'oai_' + crypto.randomUUID().slice(0, 8),
      provider, model, tokensIn, tokensOut, latencyMs,
    ).run();
  } catch { /* non-blocking */ }
}
