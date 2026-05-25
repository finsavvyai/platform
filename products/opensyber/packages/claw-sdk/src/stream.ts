import type { StreamEvent, StreamEventData } from './types.js'

/**
 * Parse an SSE response body into typed StreamEvent objects.
 * Works with any ReadableStream<Uint8Array> (fetch Response.body).
 */
export async function* parseSSEStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<StreamEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  let eventType = ''
  let dataLines: string[] = []

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          dataLines.push(line.slice(6))
        } else if (line === '') {
          if (dataLines.length > 0) {
            const event = buildEvent(eventType, dataLines.join('\n'))
            if (event) yield event
          }
          eventType = ''
          dataLines = []
        }
      }
    }

    // Flush any remaining buffered event when stream ends without trailing \n\n
    if (dataLines.length > 0) {
      const event = buildEvent(eventType, dataLines.join('\n'))
      if (event) yield event
    }
  } finally {
    reader.releaseLock()
  }
}

function buildEvent(
  eventType: string,
  rawData: string
): StreamEvent | null {
  try {
    const data = JSON.parse(rawData) as StreamEventData
    return {
      type: data.type ?? eventType,
      data,
    } as StreamEvent
  } catch {
    if (eventType === 'ping') {
      return { type: 'ping', data: { type: 'ping' } }
    }
    return null
  }
}

/**
 * Collect streamed text deltas into a single string.
 * Convenience wrapper for simple prompt→text flows.
 */
export async function collectStreamText(
  stream: AsyncIterable<StreamEvent>
): Promise<string> {
  let text = ''
  for await (const event of stream) {
    if (
      event.data.type === 'content_block_delta' &&
      'delta' in event.data &&
      'text' in event.data.delta
    ) {
      text += event.data.delta.text
    }
  }
  return text
}
