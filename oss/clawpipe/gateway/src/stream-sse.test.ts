/** Tests for SSE wrapper utilities. */

import { describe, it, expect } from 'vitest';
import { parseLastEventId, splitEvents, wrapStream } from './stream-sse';

describe('parseLastEventId', () => {
  it('returns -1 for missing header', () => {
    expect(parseLastEventId(null)).toBe(-1);
  });
  it('returns the integer when valid', () => {
    expect(parseLastEventId('5')).toBe(5);
    expect(parseLastEventId('0')).toBe(0);
  });
  it('returns -1 for negative or non-numeric', () => {
    expect(parseLastEventId('-1')).toBe(-1);
    expect(parseLastEventId('abc')).toBe(-1);
    expect(parseLastEventId('')).toBe(-1);
  });
});

describe('splitEvents', () => {
  it('splits complete events on \\n\\n', () => {
    const r = splitEvents('event: a\ndata: 1\n\nevent: b\ndata: 2\n\n');
    expect(r.events).toHaveLength(2);
    expect(r.leftover).toBe('');
  });
  it('preserves leftover at end', () => {
    const r = splitEvents('event: a\ndata: 1\n\nevent: b\nda');
    expect(r.events).toHaveLength(1);
    expect(r.leftover).toBe('event: b\nda');
  });
  it('returns empty for empty input', () => {
    expect(splitEvents('')).toEqual({ events: [], leftover: '' });
  });
});

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(enc.encode(chunks[i++]));
      else controller.close();
    },
  });
}

async function readToString(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let out = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += dec.decode(value, { stream: true });
  }
  return out;
}

describe('wrapStream', () => {
  it('emits id: counter for each event', async () => {
    const upstream = streamFromChunks(['data: a\n\n', 'data: b\n\n']);
    const out = await readToString(wrapStream(upstream));
    expect(out).toContain('id: 0\ndata: a');
    expect(out).toContain('id: 1\ndata: b');
  });

  it('skips events with id <= startAfter', async () => {
    const upstream = streamFromChunks(['data: a\n\n', 'data: b\n\n', 'data: c\n\n']);
    const out = await readToString(wrapStream(upstream, 1));
    expect(out).not.toContain('data: a');
    expect(out).not.toContain('data: b');
    expect(out).toContain('id: 2\ndata: c');
  });

  it('emits trailing partial event after upstream closes', async () => {
    const upstream = streamFromChunks(['data: tail']);
    const out = await readToString(wrapStream(upstream));
    expect(out).toContain('id: 0\ndata: tail');
  });

  it('returns empty when startAfter is past all events', async () => {
    const upstream = streamFromChunks(['data: a\n\n']);
    const out = await readToString(wrapStream(upstream, 100));
    expect(out.length).toBe(0);
  });

  it('handles chunks split across event boundaries', async () => {
    const upstream = streamFromChunks(['data: hel', 'lo\n\ndata: ', 'world\n\n']);
    const out = await readToString(wrapStream(upstream));
    expect(out).toContain('id: 0\ndata: hello');
    expect(out).toContain('id: 1\ndata: world');
  });
});
