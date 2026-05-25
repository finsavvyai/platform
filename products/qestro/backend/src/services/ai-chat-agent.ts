/**
 * AI Chat Agent — Qestro testing copilot
 *
 * Conversational agent powered by Claude. Maintains multi-turn context
 * and generates Playwright / fetch / Maestro code on request.
 *
 * Provider chain:
 *   1. Anthropic (if ANTHROPIC_API_KEY)  — preferred, Claude Sonnet
 *   2. Groq (GROQ_API_KEY)               — OpenAI-compatible fallback
 *   3. DeepSeek (DEEPSEEK_API_KEY)       — OpenAI-compatible fallback
 *   4. Gemini (GEMINI_API_KEY)           — OpenAI-compatible fallback
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-3-5-sonnet-20241022';
const MAX_TOKENS = 1024;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const QESTRO_SYSTEM_PROMPT = `You are Qestro's AI testing copilot. You help developers using AI-assisted coding tools (Cursor, Copilot, Claude Code) write, debug, and maintain Playwright, API, and mobile tests.

When a user describes what to test, generate concrete Playwright / fetch / Maestro code. When a test fails, suggest root-cause and fix. Be concise, actionable, code-first.

Respond in the same language the user writes in.`;

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
}

/** Call Claude with full chat history. */
export async function chatWithAnthropic(
  apiKey: string,
  messages: ChatMessage[],
  systemPrompt = QESTRO_SYSTEM_PROMPT,
): Promise<string> {
  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown');
    throw new Error(`Anthropic ${response.status}: ${errorBody.slice(0, 200)}`);
  }

  const data = (await response.json()) as AnthropicResponse;
  return data.content?.[0]?.text ?? '';
}

const OPENAI_COMPAT: Record<string, { url: string; model: string }> = {
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  deepseek: { url: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat' },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.0-flash',
  },
};

/** Call an OpenAI-compatible provider with system + chat history. */
async function chatWithOpenAICompat(
  provider: keyof typeof OPENAI_COMPAT,
  apiKey: string,
  messages: ChatMessage[],
  systemPrompt: string,
): Promise<string> {
  const cfg = OPENAI_COMPAT[provider];
  const response = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: 0.3,
      max_tokens: MAX_TOKENS,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`${provider} ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? '';
}

export interface ChatEnv {
  ANTHROPIC_API_KEY?: string;
  GROQ_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  GEMINI_API_KEY?: string;
}

/**
 * Try providers in order; return the first success. Throws if all fail.
 */
export async function chatWithAgent(
  env: ChatEnv,
  messages: ChatMessage[],
  systemPrompt = QESTRO_SYSTEM_PROMPT,
): Promise<{ reply: string; provider: string }> {
  if (env.ANTHROPIC_API_KEY) {
    try {
      const reply = await chatWithAnthropic(env.ANTHROPIC_API_KEY, messages, systemPrompt);
      return { reply, provider: 'anthropic' };
    } catch (err) {
      console.warn('[chat] anthropic failed:', err instanceof Error ? err.message : err);
    }
  }

  const fallbacks: Array<[keyof typeof OPENAI_COMPAT, string | undefined]> = [
    ['groq', env.GROQ_API_KEY],
    ['deepseek', env.DEEPSEEK_API_KEY],
    ['gemini', env.GEMINI_API_KEY],
  ];

  for (const [name, key] of fallbacks) {
    if (!key) continue;
    try {
      const reply = await chatWithOpenAICompat(name, key, messages, systemPrompt);
      return { reply, provider: name };
    } catch (err) {
      console.warn(`[chat] ${name} failed:`, err instanceof Error ? err.message : err);
    }
  }

  throw new Error('No AI provider available');
}
