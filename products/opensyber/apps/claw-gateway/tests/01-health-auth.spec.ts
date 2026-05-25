import { test, expect } from '@playwright/test'
import { authHeaders, getApiKey, PROJECT_ID } from './helpers'

test.describe('Health Endpoint', () => {
  test('returns status ok with service info', async ({ request }) => {
    const res = await request.get('/health')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.service).toBe('claw-gateway')
    expect(body.version).toBe('0.1.0')
    expect(body.timestamp).toBeTruthy()
  })

  test('health requires no authentication', async ({ request }) => {
    const res = await request.get('/health')
    expect(res.status()).toBe(200)
  })
})

test.describe('Authentication', () => {
  test('rejects request without Bearer token', async ({ request }) => {
    const res = await request.post('/v1/prompt', {
      headers: { 'Content-Type': 'application/json' },
      data: { prompt: 'test' },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('UNAUTHORIZED')
    expect(body.message).toContain('Missing Bearer token')
  })

  test('rejects request without X-Project-Id header', async ({ request }) => {
    const res = await request.post('/v1/prompt', {
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json',
      },
      data: { prompt: 'test' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('BAD_REQUEST')
  })

  test('rejects invalid API key', async ({ request }) => {
    const res = await request.post('/v1/prompt', {
      headers: {
        Authorization: 'Bearer invalid-key-12345',
        'X-Project-Id': PROJECT_ID,
        'Content-Type': 'application/json',
      },
      data: { prompt: 'test' },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('UNAUTHORIZED')
    expect(body.message).toContain('Invalid API key')
  })

  test('rejects non-existent project ID', async ({ request }) => {
    const res = await request.post('/v1/prompt', {
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        'X-Project-Id': 'non-existent-project',
        'Content-Type': 'application/json',
      },
      data: { prompt: 'test' },
    })
    expect(res.status()).toBe(404)
    const body = await res.json()
    expect(body.code).toBe('NOT_FOUND')
  })

  test('valid credentials pass through to prompt endpoint', async ({ request }) => {
    const res = await request.post('/v1/prompt', {
      headers: authHeaders(),
      data: { prompt: 'Say the word "authenticated" and nothing else.', maxTokens: 20 },
    })
    expect(res.status()).toBe(200)
  })
})

test.describe('Route Handling', () => {
  test('unknown v1 routes require auth first', async ({ request }) => {
    const res = await request.get('/v1/nonexistent')
    expect(res.status()).toBe(401)
  })

  test('unknown authenticated routes return 404', async ({ request }) => {
    const res = await request.get('/v1/nonexistent', { headers: authHeaders() })
    expect(res.status()).toBe(404)
  })

  test('returns 404 for root path', async ({ request }) => {
    const res = await request.get('/')
    expect(res.status()).toBe(404)
  })
})
