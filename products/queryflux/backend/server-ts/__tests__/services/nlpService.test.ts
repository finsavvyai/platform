import { initializeAIProviders, getProviderCount, getAIStatus } from '../../services/nlpService';

// Mock global fetch for provider health checks
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

afterEach(() => {
  mockFetch.mockReset();
});

describe('nlpService', () => {
  describe('initializeAIProviders', () => {
    it('initializes zero providers when no URLs given', () => {
      initializeAIProviders({});
      expect(getProviderCount()).toBe(0);
    });

    it('initializes OpenHands provider', () => {
      initializeAIProviders({ openHandsURL: 'http://localhost:8787' });
      expect(getProviderCount()).toBe(1);
    });

    it('initializes OpenClaw provider', () => {
      initializeAIProviders({ openClawURL: 'http://localhost:9090' });
      expect(getProviderCount()).toBe(1);
    });

    it('initializes both providers', () => {
      initializeAIProviders({
        openHandsURL: 'http://localhost:8787',
        openClawURL: 'http://localhost:9090',
      });
      expect(getProviderCount()).toBe(2);
    });
  });

  describe('getAIStatus', () => {
    it('returns empty providers array when none configured', async () => {
      initializeAIProviders({});
      const status = await getAIStatus();
      expect(status.providers).toHaveLength(0);
    });

    it('checks health of configured providers', async () => {
      initializeAIProviders({ openHandsURL: 'http://localhost:8787' });
      mockFetch.mockResolvedValueOnce({ ok: true });

      const status = await getAIStatus();
      expect(status.providers).toHaveLength(1);
      expect(status.providers[0].name).toBe('openhands');
      expect(status.providers[0].healthy).toBe(true);
    });

    it('reports unhealthy when provider is down', async () => {
      initializeAIProviders({ openHandsURL: 'http://localhost:8787' });
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const status = await getAIStatus();
      expect(status.providers[0].healthy).toBe(false);
    });
  });
});
