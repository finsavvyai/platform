/**
 * Multi-provider AI client with intelligent failover and Smart Router
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { HfInference } from '@huggingface/inference';
import {
  clawComplete,
  isClawEnabled,
  buildCacheKey,
  type ClawResponse,
} from './claw-client.js';

export interface LLMConfig {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  huggingfaceApiKey?: string;
}

export interface CompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  provider?: 'openai' | 'anthropic' | 'huggingface' | 'auto';
  temperature?: number;
  maxTokens?: number;
  cacheKey?: string;
  cacheTtl?: number;
  metadata?: Record<string, unknown>;
}

export interface CompletionResult {
  content: string;
  model: string;
  provider: string;
  tokensUsed: number;
  cost: number;
  cached: boolean;
  latencyMs: number;
}

const MODEL_COSTS_PER_1K: Record<string, number> = {
  'gpt-4-turbo': 0.01,
  'gpt-4o': 0.005,
  'gpt-4': 0.03,
  'gpt-3.5-turbo': 0.001,
  'claude-3-haiku-20240307': 0.00025,
  'claude-3-sonnet-20240229': 0.003,
  'claude-3-5-sonnet-20241022': 0.003,
  'claude-opus-4-20250514': 0.015,
  'huggingface-basic': 0.0001,
};

export class LLMProvider {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private hf: HfInference | null = null;

  constructor(config: LLMConfig = {}) {
    const oaiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
    const antKey = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    const hfKey = config.huggingfaceApiKey || process.env.HUGGINGFACE_API_KEY;

    if (oaiKey) this.openai = new OpenAI({ apiKey: oaiKey });
    if (antKey) this.anthropic = new Anthropic({ apiKey: antKey });
    if (hfKey) this.hf = new HfInference(hfKey);
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const start = Date.now();

    // Route through Claw Gateway if available (enables caching + smart routing)
    if (isClawEnabled()) {
      try {
        return await this.completeThroughClaw(request, start);
      } catch {
        // Fall through to direct calls
      }
    }

    // Direct provider calls with failover
    return this.completeWithFailover(request, start);
  }

  private async completeThroughClaw(
    request: CompletionRequest,
    start: number,
  ): Promise<CompletionResult> {
    const provider = request.provider === 'auto' || !request.provider
      ? 'openai'
      : request.provider;
    const model = request.model || 'gpt-4-turbo';

    const cacheKey = request.cacheKey || buildCacheKey(
      provider,
      model,
      request.systemPrompt,
      request.userPrompt,
    );

    const response: ClawResponse = await clawComplete({
      provider,
      model,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ],
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      cacheKey,
      cacheTtl: request.cacheTtl,
      metadata: request.metadata,
    });

    return {
      content: response.content,
      model: response.model,
      provider: response.provider,
      tokensUsed: response.tokensUsed,
      cost: response.cost,
      cached: response.cached,
      latencyMs: Date.now() - start,
    };
  }

  private async completeWithFailover(
    request: CompletionRequest,
    start: number,
  ): Promise<CompletionResult> {
    const provider = request.provider === 'auto' || !request.provider
      ? 'openai'
      : request.provider;
    const model = request.model || 'gpt-4-turbo';

    // Try primary provider
    if (provider === 'openai' || provider === 'auto') {
      try {
        return await this.callOpenAI(request, model, start);
      } catch { /* fallthrough */ }
    }

    // Anthropic fallback
    if (this.anthropic) {
      try {
        const fallbackModel = model.includes('gpt-4')
          ? 'claude-3-5-sonnet-20241022'
          : 'claude-3-haiku-20240307';
        return await this.callAnthropic(request, fallbackModel, start);
      } catch { /* fallthrough */ }
    }

    // HuggingFace last resort
    if (this.hf) {
      return this.callHuggingFace(request, start);
    }

    throw new Error('All AI providers failed');
  }

  private async callOpenAI(
    request: CompletionRequest,
    model: string,
    start: number,
  ): Promise<CompletionResult> {
    if (!this.openai) throw new Error('OpenAI not configured');
    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ],
      temperature: request.temperature ?? 0.3,
      max_tokens: request.maxTokens ?? 2000,
    });
    const tokensUsed = response.usage?.total_tokens || 0;
    return {
      content: response.choices[0].message.content || '',
      model,
      provider: 'openai',
      tokensUsed,
      cost: this.calculateCost(model, tokensUsed),
      cached: false,
      latencyMs: Date.now() - start,
    };
  }

  private async callAnthropic(
    request: CompletionRequest,
    model: string,
    start: number,
  ): Promise<CompletionResult> {
    if (!this.anthropic) throw new Error('Anthropic not configured');
    const response = await this.anthropic.messages.create({
      model,
      max_tokens: request.maxTokens ?? 2000,
      temperature: request.temperature ?? 0.3,
      system: request.systemPrompt,
      messages: [{ role: 'user', content: request.userPrompt }],
    });
    const content = response.content[0].type === 'text'
      ? response.content[0].text
      : '';
    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
    return {
      content,
      model,
      provider: 'anthropic',
      tokensUsed,
      cost: this.calculateCost(model, tokensUsed),
      cached: false,
      latencyMs: Date.now() - start,
    };
  }

  private async callHuggingFace(
    request: CompletionRequest,
    start: number,
  ): Promise<CompletionResult> {
    if (!this.hf) throw new Error('HuggingFace not configured');
    const hfModel = 'codellama/CodeLlama-7b-Instruct-hf';
    const response = await this.hf.textGeneration({
      model: hfModel,
      inputs: `${request.systemPrompt}\n\n${request.userPrompt}`,
      parameters: {
        max_new_tokens: request.maxTokens ?? 1000,
        temperature: request.temperature ?? 0.3,
      },
    });
    const tokensUsed = Math.floor(request.userPrompt.length / 4);
    return {
      content: response.generated_text || '',
      model: hfModel,
      provider: 'huggingface',
      tokensUsed,
      cost: this.calculateCost('huggingface-basic', tokensUsed),
      cached: false,
      latencyMs: Date.now() - start,
    };
  }

  calculateCost(model: string, tokens: number): number {
    const costPer1K = MODEL_COSTS_PER_1K[model] || 0.001;
    return (tokens / 1000) * costPer1K;
  }
}
