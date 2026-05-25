import { describe, it, expect } from 'vitest'
import { parseSSEStream, collectStreamText } from '../stream.js'

function createReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

describe('parseSSEStream', () => {
  it('parses a single text delta event', async () => {
    const body = createReadableStream([
      'event: content_block_delta\n',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n',
    ])

    const events = []
    for await (const event of parseSSEStream(body)) {
      events.push(event)
    }

    expect(events).toHaveLength(1)
    expect(events[0]?.data.type).toBe('content_block_delta')
  })

  it('parses multiple events in one chunk', async () => {
    const body = createReadableStream([
      [
        'event: message_start',
        'data: {"type":"message_start","sessionId":"s1","model":"claude"}',
        '',
        'event: content_block_delta',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}',
        '',
        'event: message_stop',
        'data: {"type":"message_stop","usage":{"inputTokens":10,"outputTokens":5},"stopReason":"end_turn"}',
        '',
      ].join('\n'),
    ])

    const events = []
    for await (const event of parseSSEStream(body)) {
      events.push(event)
    }

    expect(events).toHaveLength(3)
    expect(events[0]?.data.type).toBe('message_start')
    expect(events[1]?.data.type).toBe('content_block_delta')
    expect(events[2]?.data.type).toBe('message_stop')
  })

  it('handles chunked data split across reads', async () => {
    const body = createReadableStream([
      'event: content_block_delta\ndata: {"type":"content_blo',
      'ck_delta","index":0,"delta":{"type":"text_delta","text":"split"}}\n\n',
    ])

    const events = []
    for await (const event of parseSSEStream(body)) {
      events.push(event)
    }

    expect(events).toHaveLength(1)
    expect(events[0]?.data.type).toBe('content_block_delta')
  })

  it('handles ping events', async () => {
    const body = createReadableStream([
      'event: ping\ndata: {}\n\n',
    ])

    const events = []
    for await (const event of parseSSEStream(body)) {
      events.push(event)
    }

    expect(events).toHaveLength(1)
    expect(events[0]?.type).toBe('ping')
  })

  it('skips malformed data lines', async () => {
    const body = createReadableStream([
      'event: unknown\ndata: not-json\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"ok"}}\n\n',
    ])

    const events = []
    for await (const event of parseSSEStream(body)) {
      events.push(event)
    }

    expect(events).toHaveLength(1)
    expect(events[0]?.data.type).toBe('content_block_delta')
  })
})

describe('collectStreamText', () => {
  it('collects text deltas into a single string', async () => {
    async function* fakeStream() {
      yield {
        type: 'content_block_delta' as const,
        data: {
          type: 'content_block_delta' as const,
          index: 0,
          delta: { type: 'text_delta' as const, text: 'Hello ' },
        },
      }
      yield {
        type: 'content_block_delta' as const,
        data: {
          type: 'content_block_delta' as const,
          index: 0,
          delta: { type: 'text_delta' as const, text: 'world!' },
        },
      }
    }

    const text = await collectStreamText(fakeStream())
    expect(text).toBe('Hello world!')
  })

  it('ignores non-delta events', async () => {
    async function* fakeStream() {
      yield {
        type: 'message_start' as const,
        data: { type: 'message_start' as const, sessionId: 's1', model: 'claude' },
      }
      yield {
        type: 'content_block_delta' as const,
        data: {
          type: 'content_block_delta' as const,
          index: 0,
          delta: { type: 'text_delta' as const, text: 'only this' },
        },
      }
      yield {
        type: 'message_stop' as const,
        data: {
          type: 'message_stop' as const,
          usage: { inputTokens: 10, outputTokens: 5 },
          stopReason: 'end_turn',
        },
      }
    }

    const text = await collectStreamText(fakeStream())
    expect(text).toBe('only this')
  })
})
