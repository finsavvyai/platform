/**
 * AIProviderClient — Multi-provider AI with automatic failover
 *
 * Provider chain (first configured wins):
 *   1. OpenAI         — OPENAI_API_KEY
 *   2. Anthropic      — ANTHROPIC_API_KEY
 *   3. Groq           — GROQ_API_KEY        (fast, free tier, OpenAI-compatible)
 *   4. DeepSeek       — DEEPSEEK_API_KEY    (cheap, OpenAI-compatible)
 *   5. Gemini         — GEMINI_API_KEY      (free tier, OpenAI-compatible endpoint)
 *   6. llamafile      — LOCAL_LLM_URL       (offline, free)
 *   7. Stub response  — no provider configured
 *
 * All providers (except Anthropic) speak the OpenAI chat/completions format,
 * so the call pattern is identical — only base URL + model + auth differ.
 *
 * llamafile setup: https://github.com/mozilla-ai/llamafile
 */

import { logger } from '../utils/logger.js';

const MODEL_COSTS_PER_1K: Record<string, number> = {
  'gpt-4-turbo': 0.01,
  'gpt-4o': 0.005,
  'gpt-4': 0.03,
  'gpt-3.5-turbo': 0.001,
  'claude-3-haiku-20240307': 0.00025,
  'claude-3-sonnet-20240229': 0.003,
  'claude-3-5-sonnet-20241022': 0.003,
  'llama-3.3-70b-versatile': 0.0001,    // Groq pricing
  'deepseek-chat': 0.0001,               // DeepSeek pricing
  'gemini-2.0-flash': 0,                 // Gemini free tier
  'gemini-1.5-flash': 0,
  'llamafile-local': 0,                  // Free — runs locally
};

const PROVIDER_CONFIG = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    authHeader: (key: string) => ({ 'Authorization': `Bearer ${key}` }),
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    authHeader: (key: string) => ({ 'Authorization': `Bearer ${key}` }),
  },
  deepseek: {
    url: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    authHeader: (key: string) => ({ 'Authorization': `Bearer ${key}` }),
  },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.0-flash',
    authHeader: (key: string) => ({ 'Authorization': `Bearer ${key}` }),
  },
} as const;

export interface FailoverResult {
  content: string;
  model: string;
  tokensUsed: number;
  cost: number;
}

export class AIProviderClient {
  selectModelForPlan(planId: string, _requestType: string): string {
    if (planId === 'enterprise') return 'gpt-4-turbo';
    if (planId === 'pro') return 'gpt-4o';
    return 'gpt-3.5-turbo';
  }

  calculateCost(model: string, tokens: number): number {
    const rate = MODEL_COSTS_PER_1K[model] ?? 0.001;
    return (tokens / 1000) * rate;
  }

  async executeWithFailover(
    systemPrompt: string,
    userPrompt: string,
    originalModel: string,
  ): Promise<FailoverResult> {
    // Try providers in order — first one with a key wins
    const providers: Array<[string, string | undefined]> = [
      ['openai', process.env.OPENAI_API_KEY],
      ['groq', process.env.GROQ_API_KEY],
      ['deepseek', process.env.DEEPSEEK_API_KEY],
      ['gemini', process.env.GEMINI_API_KEY],
    ];

    for (const [name, key] of providers) {
      if (!key) continue;
      try {
        return await this.callOpenAICompatible(
          name as keyof typeof PROVIDER_CONFIG,
          key,
          systemPrompt,
          userPrompt,
        );
      } catch (err) {
        logger.warn(`AI provider ${name} failed, trying next`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Fallback: llamafile local
    if (process.env.LOCAL_LLM_URL) {
      try {
        return await this.callLlamafile(systemPrompt, userPrompt);
      } catch (err) {
        logger.error('llamafile fallback failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Last resort: stub
    logger.info('AI stub returned — no providers configured or all failed');
    return {
      content: `[AI stub] Model ${originalModel} not configured. Set OPENAI_API_KEY, GROQ_API_KEY, DEEPSEEK_API_KEY, GEMINI_API_KEY, or LOCAL_LLM_URL to enable.`,
      model: originalModel,
      tokensUsed: 0,
      cost: 0,
    };
  }

  /**
   * Unified OpenAI-compatible caller (works for OpenAI/Groq/DeepSeek/Gemini)
   */
  private async callOpenAICompatible(
    provider: keyof typeof PROVIDER_CONFIG,
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<FailoverResult> {
    const cfg = PROVIDER_CONFIG[provider];
    const response = await fetch(cfg.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...cfg.authHeader(apiKey),
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${provider} API ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage?: { total_tokens?: number };
    };

    const tokensUsed = data.usage?.total_tokens ?? 0;
    const content = data.choices[0]?.message?.content ?? '';

    logger.info(`AI ${provider} response received`, {
      model: cfg.model,
      tokens: tokensUsed,
    });

    return {
      content,
      model: cfg.model,
      tokensUsed,
      cost: this.calculateCost(cfg.model, tokensUsed),
    };
  }

  /**
   * Call llamafile (local OpenAI-compatible server)
   */
  private async callLlamafile(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<FailoverResult> {
    const url = `${process.env.LOCAL_LLM_URL}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llamafile-local',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1000,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`llamafile error: ${response.status}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage?: { total_tokens?: number };
    };

    return {
      content: data.choices[0]?.message?.content ?? '',
      model: 'llamafile-local',
      tokensUsed: data.usage?.total_tokens ?? 0,
      cost: 0,
    };
  }
}

export const aiProviderClient = new AIProviderClient();
