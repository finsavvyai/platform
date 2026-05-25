/** CF Workers AI embedding for gateway-side semantic cache. */
import type { Env } from './types';

export function makeCFEmbeddingFn(
  env: Env,
): ((text: string) => Promise<number[]>) | null {
  if (!env.AI) return null;
  return async (text: string) => {
    const result = await (env.AI as any).run('@cf/baai/bge-small-en-v1.5', {
      text: [text],
    });
    return result.data[0] as number[];
  };
}
