/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';
import { getAdapter, getApiKey, listAvailable } from './registry';
import type { Env } from '../types';

vi.mock('../auth/provider-keys', () => ({
  readProviderKey: vi.fn().mockResolvedValue(null),
}));

const PROVIDERS = [
  'openai', 'anthropic', 'deepseek', 'groq', 'gemini',
  'mistral', 'together', 'fireworks', 'openrouter', 'perplexity',
  'cohere', 'ai21', 'cerebras', 'replicate', 'huggingface',
  'writer', 'databricks', 'azure-openai', 'bedrock', 'vertex', 'xai',
];

describe('getAdapter', () => {
  it.each(PROVIDERS)('returns an adapter for %s', (p) => {
    const a = getAdapter(p);
    expect(a).toBeDefined();
    expect(typeof a!.name).toBe('string');
    expect(typeof a!.call).toBe('function');
  });

  it('returns undefined for an unknown provider', () => {
    expect(getAdapter('not-a-real-provider')).toBeUndefined();
  });
});

describe('getApiKey', () => {
  it('reads each provider key from env', async () => {
    const env = {
      OPENAI_API_KEY: 'sk-openai',
      ANTHROPIC_API_KEY: 'sk-anth',
      GROQ_API_KEY: 'sk-groq',
      AZURE_OPENAI_API_KEY: 'sk-az',
    } as unknown as Env;
    expect(await getApiKey('openai', env)).toBe('sk-openai');
    expect(await getApiKey('anthropic', env)).toBe('sk-anth');
    expect(await getApiKey('groq', env)).toBe('sk-groq');
    expect(await getApiKey('azure-openai', env)).toBe('sk-az');
  });

  it('returns undefined when key is unset', async () => {
    expect(await getApiKey('openai', {} as Env)).toBeUndefined();
  });

  it('returns undefined for unknown provider', async () => {
    expect(await getApiKey('not-real', {} as Env)).toBeUndefined();
  });

  it('prefers per-project key over env key when projectId supplied', async () => {
    const { readProviderKey } = await import('../auth/provider-keys');
    vi.mocked(readProviderKey).mockResolvedValueOnce('sk-per-project');
    const env = { OPENAI_API_KEY: 'sk-global' } as unknown as Env;
    expect(await getApiKey('openai', env, 'proj-1')).toBe('sk-per-project');
  });

  it('falls back to env key when no per-project key', async () => {
    const { readProviderKey } = await import('../auth/provider-keys');
    vi.mocked(readProviderKey).mockResolvedValueOnce(null);
    const env = { OPENAI_API_KEY: 'sk-global' } as unknown as Env;
    expect(await getApiKey('openai', env, 'proj-1')).toBe('sk-global');
  });
});

describe('listAvailable', () => {
  it('returns only providers with configured keys', () => {
    const env = { OPENAI_API_KEY: 'k', GROQ_API_KEY: 'k' } as unknown as Env;
    const list = listAvailable(env);
    expect(list).toContain('openai');
    expect(list).toContain('groq');
    expect(list).not.toContain('anthropic');
  });

  it('returns empty array when no keys are set', () => {
    expect(listAvailable({} as Env)).toEqual([]);
  });
});
