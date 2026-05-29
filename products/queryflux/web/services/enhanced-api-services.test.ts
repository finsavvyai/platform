import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/enhanced-api-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { queryKeys as sharedQueryKeys } from '../lib/queryKeys';
import { queryKeys } from './enhanced-api-services';

describe('enhanced-api-services exports', () => {
  it('re-exports the shared query key factory', () => {
    expect(queryKeys).toBe(sharedQueryKeys);
    expect(queryKeys.auth.profile()).toEqual(['auth', 'profile']);
    expect(queryKeys.metrics.latest('conn-1')).toEqual(['metrics', 'latest', 'conn-1']);
  });
});
