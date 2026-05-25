import type {
  LLMProvider,
  ChatRequest,
  ChatResponse,
  StreamChunk,
} from '../types.js';
import { getPricing } from '../costs/pricing.js';

const DEFAULT_MODEL = 'gpt-4o';
const API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIRequest {
  model: string;
  max_tokens?: number;
  messages: OpenAIMessage[];
  temperature?: number;
  response_format?: { type: string };
}

export function createOpenAIProvider(apiKey: string): LLMProvider {
  return {
    name: 'openai',

    async chat(req: ChatRequest): Promise<ChatResponse> {
      const model = req.model ?? DEFAULT_MODEL;
      const startTime = Date.now();

      const body: OpenAIRequest = {
        model,
        messages: req.messages,
        temperature: req.temperature,
      };

      if (req.maxTokens) body.max_tokens = req.maxTokens;
      if (req.responseFormat === 'json') {
        body.response_format = { type: 'json_object' };
      }

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(
          `OpenAI API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage: { prompt_tokens: number; completion_tokens: number };
      };
      const latencyMs = Date.now() - startTime;
      const promptTokens = data.usage.prompt_tokens;
      const completionTokens = data.usage.completion_tokens;
      const pricing = getPricing(model);

      const cost =
        (promptTokens * pricing.input + completionTokens * pricing.output) /
        1000000;

      return {
        content: data.choices[0]?.message?.content ?? '',
        model,
        provider: 'openai',
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
      yield { type: 'start', model, provider: 'openai' };

      const body: OpenAIRequest = {
        model,
        messages: req.messages,
        temperature: req.temperature,
      };

      if (req.maxTokens) body.max_tokens = req.maxTokens;

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ ...body, stream: true }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
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
                const data = line.substring(6);
                if (data === '[DONE]') break;

                try {
                  const json = JSON.parse(data);
                  if (json.choices?.[0]?.delta?.content) {
                    yield {
                      type: 'delta',
                      content: json.choices[0].delta.content,
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
