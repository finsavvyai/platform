/**
 * ClawPipe LanguageModelV1 implementation for the Vercel AI SDK.
 *
 * Bridges ClawPipe's prompt() and stream() methods to the
 * LanguageModelV1 doGenerate / doStream interface.
 */
import type {
  LanguageModelV1,
  LanguageModelV1CallOptions,
  LanguageModelV1CallWarning,
  LanguageModelV1FinishReason,
  LanguageModelV1StreamPart,
} from '@ai-sdk/provider';
import { ClawPipe } from 'clawpipe-ai';
import type { ClawPipeModelSettings } from './types';
import { convertPromptToText, extractSystem } from './convert-messages';

export class ClawPipeLanguageModel implements LanguageModelV1 {
  readonly specificationVersion = 'v1' as const;
  readonly provider = 'clawpipe';
  readonly modelId: string;
  readonly defaultObjectGenerationMode = undefined;

  private readonly client: ClawPipe;

  constructor(settings: ClawPipeModelSettings) {
    this.modelId = settings.modelId;
    this.client = new ClawPipe({
      apiKey: settings.providerConfig.apiKey,
      projectId: settings.providerConfig.projectId ?? 'default',
      gatewayUrl: settings.providerConfig.gatewayUrl,
      enableBooster: settings.providerConfig.enableBooster ?? true,
      enablePacker: settings.providerConfig.enablePacker ?? true,
      enableCache: settings.providerConfig.enableCache ?? true,
    });
  }

  async doGenerate(
    options: LanguageModelV1CallOptions,
  ): Promise<{
    text: string | undefined;
    toolCalls?: undefined;
    finishReason: LanguageModelV1FinishReason;
    usage: { promptTokens: number; completionTokens: number };
    rawCall: { rawPrompt: unknown; rawSettings: Record<string, unknown> };
    warnings?: LanguageModelV1CallWarning[];
  }> {
    const promptText = convertPromptToText(options.prompt);
    const system = extractSystem(options.prompt);
    const model = this.modelId === 'auto' ? undefined : this.modelId;

    const result = await this.client.prompt(promptText, {
      system,
      model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    });

    return {
      text: result.text,
      finishReason: 'stop',
      usage: {
        promptTokens: result.meta.tokensIn,
        completionTokens: result.meta.tokensOut,
      },
      rawCall: {
        rawPrompt: promptText,
        rawSettings: {
          model: result.meta.model,
          route: result.meta.route,
          boosted: result.meta.boosted,
          cached: result.meta.cached,
          estimatedCostUsd: result.meta.estimatedCostUsd,
        },
      },
    };
  }

  async doStream(
    options: LanguageModelV1CallOptions,
  ): Promise<{
    stream: ReadableStream<LanguageModelV1StreamPart>;
    rawCall: { rawPrompt: unknown; rawSettings: Record<string, unknown> };
    warnings?: LanguageModelV1CallWarning[];
  }> {
    const promptText = convertPromptToText(options.prompt);
    const system = extractSystem(options.prompt);
    const model = this.modelId === 'auto' ? undefined : this.modelId;

    const generator = this.client.stream(promptText, {
      system,
      model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    });

    const stream = createReadableFromAsync(generator);

    return {
      stream,
      rawCall: {
        rawPrompt: promptText,
        rawSettings: { model: this.modelId },
      },
    };
  }
}

/** Convert an async generator of text chunks to a V1 stream. */
function createReadableFromAsync(
  gen: AsyncGenerator<string>,
): ReadableStream<LanguageModelV1StreamPart> {
  return new ReadableStream<LanguageModelV1StreamPart>({
    async pull(controller) {
      const { value, done } = await gen.next();
      if (done) {
        controller.enqueue({
          type: 'finish',
          finishReason: 'stop',
          usage: { promptTokens: 0, completionTokens: 0 },
        });
        controller.close();
        return;
      }
      controller.enqueue({ type: 'text-delta', textDelta: value });
    },
  });
}
