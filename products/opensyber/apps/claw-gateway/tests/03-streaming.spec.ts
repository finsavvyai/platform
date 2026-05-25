import { test, expect } from '@playwright/test'
import { authHeaders, GATEWAY_URL } from './helpers'

test.describe('SSE Streaming', () => {
  test('returns text/event-stream content type', async () => {
    const res = await fetch(`${GATEWAY_URL}/v1/prompt`, {
      method: 'POST',
      headers: { ...authHeaders(), Accept: 'text/event-stream' },
      body: JSON.stringify({ prompt: 'Say "streaming works"', maxTokens: 20, stream: true }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
  })

  test('stream contains expected SSE events', async () => {
    const res = await fetch(`${GATEWAY_URL}/v1/prompt`, {
      method: 'POST',
      headers: { ...authHeaders(), Accept: 'text/event-stream' },
      body: JSON.stringify({ prompt: 'Say "hi"', maxTokens: 10, stream: true }),
    })

    const text = await res.text()
    expect(text).toContain('event: message_start')
    expect(text).toContain('event: content_block_start')
    expect(text).toContain('event: content_block_delta')
    expect(text).toContain('event: message_stop')
  })

  test('stream delta events contain text', async () => {
    const res = await fetch(`${GATEWAY_URL}/v1/prompt`, {
      method: 'POST',
      headers: { ...authHeaders(), Accept: 'text/event-stream' },
      body: JSON.stringify({ prompt: 'Count: 1, 2, 3', maxTokens: 20, stream: true }),
    })

    const text = await res.text()
    const deltaLines = text.split('\n').filter((l) => l.startsWith('data:') && l.includes('text_delta'))
    expect(deltaLines.length).toBeGreaterThan(0)

    let collected = ''
    for (const line of deltaLines) {
      const json = JSON.parse(line.replace('data: ', '').trim())
      if (json.delta?.text) collected += json.delta.text
    }
    expect(collected.length).toBeGreaterThan(0)
  })

  test('non-streaming request does not return SSE', async ({ request }) => {
    const res = await request.post('/v1/prompt', {
      headers: authHeaders(),
      data: { prompt: 'Say "not streaming"', maxTokens: 10 },
    })
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('application/json')
  })
})
