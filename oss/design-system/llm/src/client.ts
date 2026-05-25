import type {
  LLMConfig,
  LLMProvider,
  ChatRequest,
  ChatResponse,
  StreamChunk,
  CostTracker,
  LLMClientInterface,
} from './types.js';
import { createCostTracker } from './costs/tracker.js';

export function createLLM(config: LLMConfig): LLMClientInterface {
  const { providers, timeout = 30000, retryAttempts = 2 } = config;
  const costTracker = createCostTracker(config.budgetLimit);

  async function tryProviders(
    req: ChatRequest
  ): Promise<ChatResponse> {
    let lastError: Error | null = null;

    for (const provider of providers) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await Promise.race([
          provider.chat(req),
          new Promise<never>((_, reject) =>
            controller.signal.addEventListener('abort', () =>
              reject(new Error('Request timeout'))
            )
          ),
        ]);

        clearTimeout(timeoutId);
        costTracker.recordCost({
          model: req.model ?? config.defaultModel ?? 'unknown',
          provider: provider.name,
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          cost: response.cost,
          timestamp: new Date().toISOString(),
        });

        return response;
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error('Unknown error');
        continue;
      }
    }

    throw lastError ?? new Error('No providers available');
  }

  return {
    async chat(req: ChatRequest): Promise<ChatResponse> {
      let attempts = 0;
      while (attempts < retryAttempts) {
        try {
          return await tryProviders(req);
        } catch (error) {
          attempts += 1;
          if (attempts >= retryAttempts) throw error;
        }
      }
      throw new Error('Failed after retries');
    },

    async *stream(req: ChatRequest): AsyncIterable<StreamChunk> {
      for (const provider of providers) {
        try {
          for await (const chunk of provider.stream(req)) {
            yield chunk;
          }
          return;
        } catch (error) {
          continue;
        }
      }
      throw new Error('No providers available for streaming');
    },

    getCostTracker(): CostTracker {
      return costTracker;
    },
  };
}
