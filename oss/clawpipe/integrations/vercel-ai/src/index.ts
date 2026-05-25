/**
 * ClawPipe Vercel AI SDK Provider
 *
 * Factory function that creates a LanguageModelV1-compatible model
 * backed by the ClawPipe intelligent AI pipeline.
 *
 * @example
 * ```ts
 * import { generateText } from 'ai';
 * import { createClawPipe } from '@clawpipe/vercel-ai';
 *
 * const clawpipe = createClawPipe({ apiKey: 'cp_xxx' });
 * const { text } = await generateText({
 *   model: clawpipe('auto'),
 *   prompt: 'Explain recursion',
 * });
 * ```
 */
import type { LanguageModelV1 } from '@ai-sdk/provider';
import { ClawPipeLanguageModel } from './clawpipe-language-model';
import type { ClawPipeProviderConfig } from './types';

export type { ClawPipeProviderConfig, ClawPipeResponseMeta } from './types';
export { ClawPipeLanguageModel } from './clawpipe-language-model';

/**
 * Create a ClawPipe provider for the Vercel AI SDK.
 *
 * @param config - ClawPipe API key and optional project settings.
 * @returns A function that accepts a modelId and returns a LanguageModelV1.
 */
export function createClawPipe(
  config: ClawPipeProviderConfig,
): (modelId?: string) => LanguageModelV1 {
  return function clawpipeModel(
    modelId: string = 'auto',
  ): LanguageModelV1 {
    return new ClawPipeLanguageModel({
      modelId,
      providerConfig: config,
    });
  };
}
