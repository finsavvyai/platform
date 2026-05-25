import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const originalFetch = globalThis.fetch;

const { isLlamafileAvailable, llamafileComplete, localTriage } =
  await import('./llamafile.js');

function makeJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('endpoint validation — SSRF prevention', () => {
  it('throws when endpoint is a remote host in isLlamafileAvailable', async () => {
    await expect(
      isLlamafileAvailable({ endpoint: 'http://evil.com:8080' }),
    ).rejects.toThrow('llamafile endpoint must be localhost');
  });

  it('throws when endpoint is a remote IP in llamafileComplete', async () => {
    await expect(
      llamafileComplete('hello', { endpoint: 'http://10.0.0.1:8080' }),
    ).rejects.toThrow('llamafile endpoint must be localhost');
  });

  it('throws for 0.0.0.0 (non-localhost wildcard) in llamafileComplete', async () => {
    await expect(
      llamafileComplete('hello', { endpoint: 'http://0.0.0.0:8080' }),
    ).rejects.toThrow('llamafile endpoint must be localhost');
  });

  it('throws for metadata service address in isLlamafileAvailable', async () => {
    await expect(
      isLlamafileAvailable({ endpoint: 'http://169.254.169.254' }),
    ).rejects.toThrow('llamafile endpoint must be localhost');
  });

  it('accepts 127.0.0.1 as a valid endpoint', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse({}, true));
    const result = await isLlamafileAvailable({ endpoint: 'http://127.0.0.1:8080' });
    expect(result).toBe(true);
    globalThis.fetch = originalFetch;
  });

  it('accepts localhost as a valid endpoint', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse({}, true));
    const result = await isLlamafileAvailable({ endpoint: 'http://localhost:8080' });
    expect(result).toBe(true);
    globalThis.fetch = originalFetch;
  });
});

describe('isLlamafileAvailable', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns true when /v1/models responds with ok', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeJsonResponse({}, true));
    const result = await isLlamafileAvailable();
    expect(result).toBe(true);
  });

  it('returns false when /v1/models responds with non-ok status', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeJsonResponse({}, false, 503));
    const result = await isLlamafileAvailable();
    expect(result).toBe(false);
  });

  it('returns false when fetch throws (server not running)', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const result = await isLlamafileAvailable();
    expect(result).toBe(false);
  });

  it('hits the default endpoint /v1/models', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeJsonResponse({}, true));
    await isLlamafileAvailable();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/v1/models',
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('uses custom endpoint when provided', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeJsonResponse({}, true));
    await isLlamafileAvailable({ endpoint: 'http://localhost:9090' });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:9090/v1/models',
      expect.anything(),
    );
  });
});

describe('llamafileComplete', () => {
  const MOCK_COMPLETION_RESPONSE = {
    choices: [{ message: { content: 'This is a P1 critical finding.' } }],
    model: 'llama-3-8b',
    usage: { total_tokens: 42 },
  };

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns parsed text, model, and tokensUsed on success', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      makeJsonResponse(MOCK_COMPLETION_RESPONSE),
    );

    const result = await llamafileComplete('Analyze this finding');

    expect(result.text).toBe('This is a P1 critical finding.');
    expect(result.model).toBe('llama-3-8b');
    expect(result.tokensUsed).toBe(42);
  });

  it('sends POST to /v1/chat/completions with correct body', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      makeJsonResponse(MOCK_COMPLETION_RESPONSE),
    );

    await llamafileComplete('Test prompt');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('Test prompt'),
      }),
    );
  });

  it('throws on non-ok HTTP response', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeJsonResponse({}, false, 500));

    await expect(llamafileComplete('hello')).rejects.toThrow('llamafile error: 500');
  });

  it('returns empty text when choices array is empty', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      makeJsonResponse({ choices: [], model: 'llama-3-8b', usage: { total_tokens: 0 } }),
    );

    const result = await llamafileComplete('hello');
    expect(result.text).toBe('');
    expect(result.tokensUsed).toBe(0);
  });

  it('falls back to unknown model when model field is missing', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      makeJsonResponse({
        choices: [{ message: { content: 'ok' } }],
        usage: { total_tokens: 10 },
      }),
    );

    const result = await llamafileComplete('hello');
    expect(result.model).toBe('unknown');
  });
});

describe('localTriage', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const FINDING = {
    title: 'S3 bucket publicly accessible',
    description: 'Bucket acl allows public read access',
    severity: 'HIGH',
  };

  it('returns assessment and extracts priority from response text', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      makeJsonResponse({
        choices: [{ message: { content: 'Critical issue. Suggested priority: P1.' } }],
        model: 'llama-3-8b',
        usage: { total_tokens: 20 },
      }),
    );

    const result = await localTriage(FINDING);

    expect(result.assessment).toBe('Critical issue. Suggested priority: P1.');
    expect(result.suggestedPriority).toBe('P1');
  });

  it('defaults to P2 when no Px pattern is found in the response', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      makeJsonResponse({
        choices: [{ message: { content: 'No priority mentioned.' } }],
        model: 'llama-3-8b',
        usage: { total_tokens: 10 },
      }),
    );

    const result = await localTriage(FINDING);

    expect(result.suggestedPriority).toBe('P2');
  });

  it('correctly extracts P0 for critical findings', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      makeJsonResponse({
        choices: [{ message: { content: 'Immediate action required. P0 severity.' } }],
        model: 'llama-3-8b',
        usage: { total_tokens: 15 },
      }),
    );

    const result = await localTriage(FINDING);
    expect(result.suggestedPriority).toBe('P0');
  });

  it('includes finding fields in the prompt sent to llamafile', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      makeJsonResponse({
        choices: [{ message: { content: 'P3 low risk.' } }],
        model: 'llama-3-8b',
        usage: { total_tokens: 8 },
      }),
    );

    await localTriage(FINDING);

    const body = JSON.parse(
      (vi.mocked(globalThis.fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    const userContent: string = body.messages[0].content;
    expect(userContent).toContain(FINDING.title);
    expect(userContent).toContain(FINDING.description);
    expect(userContent).toContain(FINDING.severity);
  });
});
