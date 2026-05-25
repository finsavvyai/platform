import { describe, expect, it, vi } from 'vitest';
import { createBillingApi } from '../billing';
import type { ApiFetchFn } from '../types';

describe('createBillingApi', () => {
  it('fetches feature access metadata for paid gates', async () => {
    const fetchFn = vi.fn(async () => ({
      success: true,
      access: {
        feature: 'github_repository_scan',
        hasAccess: true,
        planId: 'pro'
      }
    })) as ApiFetchFn;
    const api = createBillingApi(fetchFn);

    const result = await api.getFeatureAccess('github_repository_scan');

    expect(result).toEqual({
      success: true,
      access: {
        feature: 'github_repository_scan',
        hasAccess: true,
        planId: 'pro'
      }
    });
    expect(fetchFn).toHaveBeenCalledWith(
      '/api/billing/feature-access/github_repository_scan'
    );
  });
});
