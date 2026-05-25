import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGcpAccessToken } from './gcp-auth.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock crypto.subtle for JWT signing in tests
const mockSign = vi.fn(() => Promise.resolve(new ArrayBuffer(64)));
const mockImportKey = vi.fn(() => Promise.resolve({} as CryptoKey));

vi.stubGlobal('crypto', {
  ...crypto,
  subtle: {
    ...crypto.subtle,
    importKey: mockImportKey,
    sign: mockSign,
  },
});

const VALID_SERVICE_ACCOUNT_KEY = JSON.stringify({
  client_email: 'test@project.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIBVQIBADANBg==\n-----END PRIVATE KEY-----',
});

describe('GCP Auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockImportKey.mockResolvedValue({} as CryptoKey);
    mockSign.mockResolvedValue(new ArrayBuffer(64));
  });

  it('should return access token on successful exchange', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'ya29.test-token-123' }),
    } as Response);

    const token = await getGcpAccessToken(VALID_SERVICE_ACCOUNT_KEY);

    expect(token).toBe('ya29.test-token-123');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(options.method).toBe('POST');
  });

  it('should include JWT assertion in request body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'ya29.test' }),
    } as Response);

    await getGcpAccessToken(VALID_SERVICE_ACCOUNT_KEY);

    const body = mockFetch.mock.calls[0][1].body as string;
    expect(body).toContain('grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer');
    expect(body).toContain('assertion=');
  });

  it('should throw on token exchange failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => '{"error":"invalid_grant"}',
    } as Response);

    await expect(getGcpAccessToken(VALID_SERVICE_ACCOUNT_KEY)).rejects.toThrow(
      'Token exchange failed (401)',
    );
  });

  it('should throw on invalid service account key', async () => {
    await expect(getGcpAccessToken('{}')).rejects.toThrow(
      'Invalid service account key',
    );
  });

  it('should throw on malformed JSON', async () => {
    await expect(getGcpAccessToken('not-json')).rejects.toThrow();
  });

  it('should use correct content type header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'ya29.test' }),
    } as Response);

    await getGcpAccessToken(VALID_SERVICE_ACCOUNT_KEY);

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });
});
