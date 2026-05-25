import { test, expect } from '@playwright/test'
import { authHeaders, GATEWAY_URL } from './helpers'

test.describe('Error Handling', () => {
  test('invalid JSON body returns error', async ({ request }) => {
    const res = await request.post('/v1/prompt', {
      headers: { ...authHeaders(), 'Content-Type': 'text/plain' },
      data: 'not json {{{',
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test('prompt with invalid maxTokens is rejected', async ({ request }) => {
    const res = await request.post('/v1/prompt', {
      headers: authHeaders(),
      data: { prompt: 'test', maxTokens: -1 },
    })
    expect(res.status()).toBe(400)
  })

  test('prompt with maxTokens over limit is rejected', async ({ request }) => {
    const res = await request.post('/v1/prompt', {
      headers: authHeaders(),
      data: { prompt: 'test', maxTokens: 999999 },
    })
    expect(res.status()).toBe(400)
  })

  test('invalid provider returns error', async ({ request }) => {
    const res = await request.post('/v1/prompt', {
      headers: authHeaders(),
      data: { prompt: 'test', provider: 'invalid-provider' },
    })
    expect(res.status()).toBe(400)
  })

  test('404 on deeply nested unknown path', async ({ request }) => {
    const res = await request.get('/v1/sessions/fake-id/nested/deep/path', {
      headers: authHeaders(),
    })
    expect(res.status()).toBe(404)
  })

  test('CORS preflight returns allowed methods', async () => {
    const res = await fetch(`${GATEWAY_URL}/v1/prompt`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://opensyber.cloud', 'Access-Control-Request-Method': 'POST' },
    })
    expect(res.status).toBeLessThan(400)
  })
})

test.describe('Session Error Cases', () => {
  test('message to non-existent session returns error', async ({ request }) => {
    const res = await request.post('/v1/sessions/nonexistent-session-id/message', {
      headers: authHeaders(),
      data: { prompt: 'hello', maxTokens: 10 },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test('session message with empty prompt rejected', async ({ request }) => {
    const res = await request.post('/v1/sessions/any-id/message', {
      headers: authHeaders(),
      data: { prompt: '' },
    })
    expect(res.status()).toBe(400)
  })

  test('create session with invalid provider rejected', async ({ request }) => {
    const res = await request.post('/v1/sessions', {
      headers: authHeaders(),
      data: { provider: 'not-real' },
    })
    expect(res.status()).toBe(400)
  })
})
