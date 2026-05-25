import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { streamWithAgent } from './chat-agent.js';

function sseStreamBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

describe('streamWithAgent', () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it('yields text deltas parsed from content_block_delta SSE events', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(
      sseStreamBody([
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}\n\n',
        'data: [DONE]\n\n',
      ]),
      { status: 200 },
    ));

    const chunks: string[] = [];
    for await (const c of streamWithAgent('sk-test', [{ role: 'user', content: 'hi' }])) {
      chunks.push(c);
    }

    expect(chunks).toEqual(['Hello', ' world']);
  });

  it('skips malformed SSE frames rather than aborting the stream', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(
      sseStreamBody([
        'data: {not valid json}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"resilient"}}\n\n',
      ]),
      { status: 200 },
    ));

    const chunks: string[] = [];
    for await (const c of streamWithAgent('sk-test', [{ role: 'user', content: 'hi' }])) {
      chunks.push(c);
    }

    expect(chunks).toEqual(['resilient']);
  });

  it('ignores non-text_delta frames (message_start, message_stop, etc.)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(
      sseStreamBody([
        'data: {"type":"message_start","message":{}}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"X"}}\n\n',
        'data: {"type":"message_stop"}\n\n',
      ]),
      { status: 200 },
    ));

    const chunks: string[] = [];
    for await (const c of streamWithAgent('sk-test', [{ role: 'user', content: 'hi' }])) {
      chunks.push(c);
    }

    expect(chunks).toEqual(['X']);
  });

  it('throws on non-2xx upstream responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('upstream down', { status: 503 }));
    const gen = streamWithAgent('sk-test', [{ role: 'user', content: 'hi' }]);
    await expect(gen.next()).rejects.toThrow(/503/);
  });

  it('sends stream:true + Anthropic headers to the upstream API', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(sseStreamBody([]), { status: 200 }));
    globalThis.fetch = mockFetch;

    const gen = streamWithAgent('sk-test', [{ role: 'user', content: 'hi' }]);
    await gen.next();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(JSON.parse(String(init.body))).toMatchObject({ stream: true });
  });
});
