/**
 * ClawPipe-backed ClawClient — every prompt flows through clawpipe-ai's
 * full pipeline (Booster + Packer + Cache + Router + Budget + RateLimiter).
 *
 * Migration: change `import { ClawClient } from '@opensyber/claw-sdk'`
 * to       `import { ClawClient } from '@opensyber/claw-sdk/clawpipe'`
 * No other code changes needed for prompt() and ask() — types and methods
 * match.
 *
 * Note: clawpipe-ai@3.x removed its session primitive (ClawSession +
 * MemorySessionStore). Session APIs on this adapter are thin in-memory
 * stubs that replay full history on every turn. For multi-turn flows
 * with server-side persistence, use the main gateway ClawClient instead
 * (`import { ClawClient } from '@opensyber/claw-sdk'`).
 */
import { ClawPipe, type ClawPipeConfig } from 'clawpipe-ai';
import type { ClawConfig, ClawRequest, ClawResponse, SessionInfo } from './types.js';
import { resolveModel } from './providers.js';

const DEFAULT_GATEWAY = 'https://api.clawpipe.ai/v1';

interface StoredSession {
  id: string;
  createdAt: number;
  lastActiveAt: number;
  system?: string;
  turns: Array<{ role: 'user' | 'assistant'; text: string }>;
  totalTokens: number;
}

function toPipeConfig(c: ClawConfig): ClawPipeConfig {
  return {
    apiKey: c.apiKey,
    projectId: c.projectId,
    gatewayUrl: c.endpoint?.includes('opensyber.cloud') ? DEFAULT_GATEWAY : c.endpoint,
    enableBooster: true,
    enablePacker: true,
    enableCache: true,
    enableTrace: false,
  };
}

function toIsoString(ms: number): string {
  return new Date(ms).toISOString();
}

export class ClawClient {
  private pipe: ClawPipe;
  private model: string;
  private provider: string;
  private maxTokens: number;
  private sessions = new Map<string, StoredSession>();

  constructor(config: ClawConfig) {
    const resolved = config.model ? resolveModel(config.model, config.provider) : null;
    this.provider = resolved?.provider ?? config.provider ?? 'anthropic';
    this.model = resolved?.modelId ?? config.model ?? 'claude-sonnet-4-6';
    this.maxTokens = config.maxTokens ?? 8192;
    this.pipe = new ClawPipe(toPipeConfig(config));
  }

  async prompt(prompt: string, options?: Partial<ClawRequest>): Promise<ClawResponse> {
    const r = await this.pipe.prompt(prompt, {
      system: options?.system,
      maxTokens: options?.maxTokens ?? this.maxTokens,
      model: options?.model ?? this.model,
      provider: (options?.provider ?? this.provider) as string,
    });
    return {
      sessionId: '',
      text: r.text,
      content: [{ type: 'text', text: r.text }],
      usage: {
        inputTokens: r.meta.tokensIn,
        outputTokens: r.meta.tokensOut,
      },
      stopReason: 'end_turn',
    };
  }

  async ask(prompt: string, options?: Partial<ClawRequest>): Promise<string> {
    const r = await this.prompt(prompt, options);
    return r.text;
  }

  async createSession(system?: string): Promise<SessionInfo> {
    const now = Date.now();
    const id = `claw-pipe-${now}-${Math.random().toString(36).slice(2, 10)}`;
    const session: StoredSession = {
      id,
      createdAt: now,
      lastActiveAt: now,
      system,
      turns: [],
      totalTokens: 0,
    };
    this.sessions.set(id, session);
    return {
      id,
      projectId: '',
      status: 'active',
      createdAt: toIsoString(now),
      lastActiveAt: toIsoString(now),
      messageCount: 0,
      totalTokens: 0,
    };
  }

  async sessionAsk(sessionId: string, prompt: string): Promise<string> {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error(`session ${sessionId} not found`);

    const history = s.turns
      .map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.text}`)
      .join('\n\n');
    const fullPrompt = history ? `${history}\n\nUser: ${prompt}` : prompt;

    const r = await this.pipe.prompt(fullPrompt, {
      system: s.system,
      maxTokens: this.maxTokens,
      model: this.model,
      provider: this.provider,
    });

    s.turns.push({ role: 'user', text: prompt });
    s.turns.push({ role: 'assistant', text: r.text });
    s.lastActiveAt = Date.now();
    s.totalTokens += r.meta.tokensIn + r.meta.tokensOut;

    return r.text;
  }
}
