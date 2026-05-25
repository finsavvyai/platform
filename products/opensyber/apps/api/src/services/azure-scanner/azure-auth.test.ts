import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAzureAccessToken } from './azure-auth.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Azure Auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('should return access token on successful auth', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.test',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    } as Response);

    const token = await getAzureAccessToken('tenant-123', 'client-456', 'secret-789');

    expect(token).toBe('eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.test');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should call correct Azure AD token endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'test-token' }),
    } as Response);

    await getAzureAccessToken('my-tenant', 'my-client', 'my-secret');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://login.microsoftonline.com/my-tenant/oauth2/v2.0/token');
  });

  it('should send correct request body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'test-token' }),
    } as Response);

    await getAzureAccessToken('tenant-1', 'client-1', 'secret-1');

    const body = mockFetch.mock.calls[0][1].body as string;
    expect(body).toContain('grant_type=client_credentials');
    expect(body).toContain('client_id=client-1');
    expect(body).toContain('client_secret=secret-1');
    expect(body).toContain('scope=https%3A%2F%2Fmanagement.azure.com%2F.default');
  });

  it('should throw on token request failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => '{"error":"invalid_client"}',
    } as Response);

    await expect(
      getAzureAccessToken('tenant', 'client', 'bad-secret'),
    ).rejects.toThrow('Azure token request failed (401)');
  });

  it('should throw on missing credentials', async () => {
    await expect(
      getAzureAccessToken('', 'client', 'secret'),
    ).rejects.toThrow('Missing Azure credentials');
  });
});
