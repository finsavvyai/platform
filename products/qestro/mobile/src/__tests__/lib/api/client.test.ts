import { apiFetch, ApiError } from '../../../lib/api/client';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue('test-token'),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('apiFetch', () => {
  it('should make a GET request with auth header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: { id: '1' } }),
    });

    const result = await apiFetch('/api/test');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/test'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(result).toEqual({ success: true, data: { id: '1' } });
  });

  it('should make a POST request with body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    await apiFetch('/api/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'test' }),
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      }),
    );
  });

  it('should throw ApiError on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Bad request' }),
    });

    await expect(apiFetch('/api/test')).rejects.toThrow(ApiError);
    await expect(apiFetch('/api/test')).rejects.toThrow();
  });

  it('should throw ApiError with correct status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    });

    try {
      await apiFetch('/api/test');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(404);
    }
  });
});

describe('ApiError', () => {
  it('should have message and status', () => {
    const err = new ApiError('Test error', 500);
    expect(err.message).toBe('Test error');
    expect(err.status).toBe(500);
    expect(err.name).toBe('ApiError');
  });
});
