/**
 * Claw Gateway Client — Routes AI calls through shared gateway proxy
 * Enables: ReasoningBank caching, Smart Router, token tracking, cost savings
 */

export interface ClawConfig {
  gatewayUrl: string;
  projectId: string;
  apiKey: string;
  enabled: boolean;
  timeout: number;
}

export interface ClawRequest {
  provider: 'openai' | 'anthropic' | 'huggingface';
  model: string;
  messages: ClawMessage[];
  temperature?: number;
  maxTokens?: number;
  cacheKey?: string;
  cacheTtl?: number;
  metadata?: Record<string, unknown>;
}

export interface ClawMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ClawResponse {
  content: string;
  model: string;
  provider: string;
  tokensUsed: number;
  cost: number;
  cached: boolean;
  latencyMs: number;
  requestId: string;
}

const DEFAULT_CONFIG: ClawConfig = {
  gatewayUrl: 'https://claw-gateway.workers.dev',
  projectId: 'qestro',
  apiKey: '',
  enabled: false,
  timeout: 30000,
};

let config: ClawConfig = { ...DEFAULT_CONFIG };

export function initClawGateway(overrides: Partial<ClawConfig>): void {
  config = { ...DEFAULT_CONFIG, ...overrides };
}

export function isClawEnabled(): boolean {
  return config.enabled && !!config.apiKey;
}

export async function clawComplete(
  request: ClawRequest,
): Promise<ClawResponse> {
  if (!isClawEnabled()) {
    throw new Error('Claw Gateway not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    const response = await fetch(`${config.gatewayUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'X-Project-Id': config.projectId,
        'X-Cache-Key': request.cacheKey || '',
        'X-Cache-TTL': String(request.cacheTtl || 3600),
      },
      body: JSON.stringify({
        provider: request.provider,
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.3,
        max_tokens: request.maxTokens ?? 2000,
        metadata: request.metadata,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claw Gateway error (${response.status}): ${error}`);
    }

    return (await response.json()) as ClawResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function buildCacheKey(
  provider: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): string {
  const raw = `${provider}:${model}:${systemPrompt}:${userPrompt}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `claw:${config.projectId}:${Math.abs(hash).toString(36)}`;
}
