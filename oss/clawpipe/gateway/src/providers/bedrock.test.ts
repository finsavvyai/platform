/**
 * Bedrock SigV4 — unit tests for signing helpers + integration test (skipped without creds).
 * Integration: AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_REGION env vars required.
 */

declare const process: { env: Record<string, string | undefined> };
import { describe, it, expect, vi, afterEach } from 'vitest';
import { bedrockAdapter } from './bedrock';

// ── Unit: SigV4 helpers are private, test via observable adapter behaviour ────

describe('bedrockAdapter.call — bad apiKey format', () => {
  it('throws on wrong pipe-count', async () => {
    await expect(
      bedrockAdapter.call(
        { prompt: 'hi', provider: 'bedrock', model: 'anthropic.claude-3-5-sonnet-20241022-v2:0' },
        'bad-key',
      ),
    ).rejects.toThrow('Bedrock: expected REGION|ACCESS_KEY_ID|SECRET_ACCESS_KEY');
  });
});

describe('bedrockAdapter.call — signed request shape', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('sends POST to correct Bedrock endpoint with Authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ text: 'hello from bedrock' }],
          usage: { input_tokens: 5, output_tokens: 4 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await bedrockAdapter.call(
      { prompt: 'say hello', provider: 'bedrock', model: 'anthropic.claude-3-5-sonnet-20241022-v2:0' },
      'us-east-1|AKIAIOSFODNN7EXAMPLE|wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    );

    expect(result.text).toBe('hello from bedrock');
    expect(result.tokensIn).toBe(5);
    expect(result.tokensOut).toBe(4);

    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('bedrock-runtime.us-east-1.amazonaws.com');
    expect(calledUrl).toContain('anthropic.claude-3-5-sonnet-20241022-v2');

    const headers = calledInit.headers as Record<string, string>;
    expect(headers['Authorization']).toMatch(/^AWS4-HMAC-SHA256 Credential=/);
    expect(headers['X-Amz-Date']).toMatch(/^\d{8}T\d{6}Z$/);
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('parses Titan response correctly', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ results: [{ outputText: 'titan says hi' }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await bedrockAdapter.call(
      { prompt: 'hi', provider: 'bedrock', model: 'amazon.titan-text-express-v1' },
      'eu-west-1|KEY|SECRET',
    );
    expect(result.text).toBe('titan says hi');
    expect(result.tokensIn).toBe(0);
  });

  it('throws on non-200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('AccessDeniedException', { status: 403 }),
    ));
    await expect(
      bedrockAdapter.call(
        { prompt: 'x', provider: 'bedrock', model: 'anthropic.claude-3-5-sonnet-20241022-v2:0' },
        'us-east-1|K|S',
      ),
    ).rejects.toThrow('Bedrock 403');
  });
});

// ── Integration (requires real AWS credentials) ───────────────────────────────

describe('bedrockAdapter — integration', () => {
  const region = process.env.AWS_REGION ?? 'us-east-1';
  const key = process.env.AWS_ACCESS_KEY_ID;
  const secret = process.env.AWS_SECRET_ACCESS_KEY;
  const skip = !key || !secret;

  it.skipIf(skip)('real call to anthropic.claude-3-haiku-20240307-v1:0', async () => {
    const result = await bedrockAdapter.call(
      { prompt: 'Reply with exactly the word: pong', provider: 'bedrock', model: 'anthropic.claude-3-haiku-20240307-v1:0' },
      `${region}|${key}|${secret}`,
    );
    expect(typeof result.text).toBe('string');
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.tokensIn).toBeGreaterThan(0);
    expect(result.latencyMs).toBeGreaterThan(0);
  });
});
