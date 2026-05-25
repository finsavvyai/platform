import { describe, expect, it, vi } from 'vitest';
import { createAiRecorderApi } from '../ai-recorder';
import type { ApiFetchFn } from '../types';

describe('createAiRecorderApi', () => {
  it('posts repository scan data to the test generation endpoint', async () => {
    const fetchFn = vi.fn(async () => ({
      success: true,
      data: { prompt: 'scan prompt', scenarios: [] }
    })) as ApiFetchFn;
    const api = createAiRecorderApi(fetchFn);

    const result = await api.scanRepositoryForScenarios({
      repositoryUrl: 'https://github.com/acme/shop',
      branch: 'develop',
      focus: 'checkout risk',
      persona: 'product'
    });

    expect(result).toEqual({
      success: true,
      data: { prompt: 'scan prompt', scenarios: [] }
    });
    expect(fetchFn).toHaveBeenCalledWith('/api/testgen/repository-scan', {
      method: 'POST',
      body: JSON.stringify({
        repositoryUrl: 'https://github.com/acme/shop',
        branch: 'develop',
        focus: 'checkout risk',
        persona: 'product'
      })
    });
  });
});
