import { OpenHandsProvider, OpenClawProvider } from '../../services/aiProviders';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

afterEach(() => {
  mockFetch.mockReset();
});

describe('OpenHandsProvider', () => {
  const provider = new OpenHandsProvider('http://localhost:8787', 'test-key');

  it('has correct name', () => {
    expect(provider.name).toBe('openhands');
  });

  describe('convertNLToSQL', () => {
    it('sends correct request and returns SQL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sql: 'SELECT * FROM users' }),
      });

      const sql = await provider.convertNLToSQL('show all users', 'Table: users');
      expect(sql).toBe('SELECT * FROM users');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/queryflux/generate-sql',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-key',
          }),
        }),
      );
    });

    it('throws on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal error',
      });

      await expect(provider.convertNLToSQL('test', 'schema')).rejects.toThrow('HTTP 500');
    });
  });

  describe('optimizeQuery', () => {
    it('returns optimized SQL and explanation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          optimizedQuery: 'SELECT id FROM users',
          explanation: 'Removed wildcard',
        }),
      });

      const result = await provider.optimizeQuery('SELECT * FROM users', 'schema');
      expect(result.optimizedSQL).toBe('SELECT id FROM users');
      expect(result.explanation).toBe('Removed wildcard');
    });
  });

  describe('explainQuery', () => {
    it('returns explanation string', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ explanation: 'This query selects all rows.' }),
      });

      const result = await provider.explainQuery('SELECT * FROM users');
      expect(result).toBe('This query selects all rows.');
    });
  });

  describe('isHealthy', () => {
    it('returns true when health endpoint responds OK', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      expect(await provider.isHealthy()).toBe(true);
    });

    it('returns false when health endpoint fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
      expect(await provider.isHealthy()).toBe(false);
    });
  });
});

describe('OpenClawProvider', () => {
  const provider = new OpenClawProvider('http://localhost:9090', 'claw-key');

  it('has correct name', () => {
    expect(provider.name).toBe('openclaw');
  });

  describe('convertNLToSQL', () => {
    it('sends correct request format for OpenClaw API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sql: 'SELECT count(*) FROM orders' }),
      });

      const sql = await provider.convertNLToSQL('count orders', 'Table: orders');
      expect(sql).toBe('SELECT count(*) FROM orders');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:9090/api/v1/nl-to-sql',
        expect.objectContaining({ method: 'POST' }),
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.naturalLanguage).toBe('count orders');
      expect(body.databaseSchema).toBe('Table: orders');
    });
  });

  describe('isHealthy', () => {
    it('returns true on OK response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      expect(await provider.isHealthy()).toBe(true);
    });

    it('returns false on failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      expect(await provider.isHealthy()).toBe(false);
    });
  });
});
