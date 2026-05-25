import type {
  LLMProvider,
  ChatRequest,
  ChatResponse,
  StreamChunk,
} from '../types.js';
import { getPricing } from '../costs/pricing.js';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const API_ENDPOINT = 'https://api.anthropic.com/v1/messages';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: AnthropicMessage[];
  temperature?: number;
}

export function createAnthropicProvider(apiKey: string): LLMProvider {
  return {
    name: 'anthropic',

    async chat(req: ChatRequest): Promise<ChatResponse> {
      const model = req.model ?? DEFAULT_MODEL;
      const startTime = Date.now();

      const systemMsg = req.messages.find((m) => m.role === 'system')?.content;
      const otherMsgs = req.messages.filter((m) => m.role !== 'system');

      const body: AnthropicRequest = {
        model,
        max_tokens: req.maxTokens ?? 4096,
        messages: otherMsgs.map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        })),
      };

      if (systemMsg) body.system = systemMsg;
      if (req.temperature !== undefined) body.temperature = req.temperature;

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(
          `Anthropic API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as {
        content: Array<{ type: string; text: string }>;
        usage: { input_tokens: number; output_tokens: number };
      };
      const latencyMs = Date.now() - startTime;
      const promptTokens = data.usage.input_tokens;
      const completionTokens = data.usage.output_tokens;
      const pricing = getPricing(model);

      const cost =
        (promptTokens * pricing.input + completionTokens * pricing.output) /
        1000000;

      return {
        content: data.content[0]?.text ?? '',
        model,
        provider: 'anthropic',
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
        cost,
        latencyMs,
      };
    },

    async *stream(req: ChatRequest): AsyncIterable<StreamChunk> {
      const model = req.model ?? DEFAULT_MODEL;
      yield { type: 'start', model, provider: 'anthropic' };

      const systemMsg = req.messages.find((m) => m.role === 'system')?.content;
      const otherMsgs = req.messages.filter((m) => m.role !== 'system');

      const body: AnthropicRequest = {
        model,
        max_tokens: req.maxTokens ?? 4096,
        messages: otherMsgs.map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        })),
      };

      if (systemMsg) body.system = systemMsg;

      const response = await fetch(`${API_ENDPOINT}?stream=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value);
            const lines = text.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const json = JSON.parse(line.substring(6));
                  if (
                    json.type === 'content_block_delta' &&
                    json.delta?.type === 'text_delta'
                  ) {
                    yield {
                      type: 'delta',
                      content: json.delta.text,
                    };
                  }
                } catch {
                  // Skip parsing errors
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }

      yield { type: 'end' };
    },
  };
}
