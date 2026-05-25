import type {
  LLMProvider,
  ChatRequest,
  ChatResponse,
  StreamChunk,
} from '../types.js';

const DEFAULT_MODEL = 'llama2';
const API_ENDPOINT = 'http://localhost:11434/api/chat';

interface OllamaMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OllamaRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  temperature?: number;
}

export function createOllamaProvider(): LLMProvider {
  return {
    name: 'ollama',

    async chat(req: ChatRequest): Promise<ChatResponse> {
      const model = req.model ?? DEFAULT_MODEL;
      const startTime = Date.now();

      const body: OllamaRequest = {
        model,
        messages: req.messages,
        temperature: req.temperature,
      };

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(
          `Ollama API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as {
        message: { content: string };
        eval_count?: number;
        prompt_eval_count?: number;
      };
      const latencyMs = Date.now() - startTime;

      return {
        content: data.message.content,
        model,
        provider: 'ollama',
        usage: {
          promptTokens: data.prompt_eval_count ?? 0,
          completionTokens: data.eval_count ?? 0,
          totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
        },
        cost: 0,
        latencyMs,
      };
    },

    async *stream(req: ChatRequest): AsyncIterable<StreamChunk> {
      const model = req.model ?? DEFAULT_MODEL;
      yield { type: 'start', model, provider: 'ollama' };

      const body: OllamaRequest = {
        model,
        messages: req.messages,
        stream: true,
        temperature: req.temperature,
      };

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value);
            const lines = buffer.split('\n');
            buffer = lines[lines.length - 1] ?? '';

            for (let i = 0; i < lines.length - 1; i++) {
              try {
                const json = JSON.parse(lines[i]);
                if (json.message?.content) {
                  yield {
                    type: 'delta',
                    content: json.message.content,
                  };
                }
              } catch {
                // Skip parsing errors
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
