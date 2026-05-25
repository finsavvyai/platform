import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkPackageThreat } from './socket-npm.js';

describe('socket-npm: threat detection', () => {
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  describe('checkPackageThreat', () => {
    it('returns threat levels: critical, high, medium, low', async () => {
      const levels = ['critical', 'high', 'medium', 'low'] as const;

      for (const level of levels) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ threat: { level } }),
        });

        const threat = await checkPackageThreat('pkg', '1.0.0', 'key');
        expect(threat).toBe(level);
      }
    });

    it('returns null when response not ok or no threat data', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      expect(await checkPackageThreat('pkg', '1.0.0', 'key')).toBeNull();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });
      expect(await checkPackageThreat('pkg', '1.0.0', 'key')).toBeNull();
    });

    it('handles API errors and network failures gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const threat = await checkPackageThreat('lodash', '1.0.0', 'key');
      expect(threat).toBeNull();
    });

    it('constructs correct API URL with encoded package and version', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ threat: { level: 'low' } }),
      });

      await checkPackageThreat('my-package@scope', '2.1.3', 'test-key');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api.socket.dev'),
        expect.any(Object),
      );
    });

    it('sends Authorization header with Bearer token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ threat: { level: 'low' } }),
      });

      await checkPackageThreat('pkg', '1.0.0', 'sk-test-key-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer sk-test-key-123',
          }),
          method: 'POST',
        }),
      );
    });
  });
});
