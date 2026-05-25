import { test, expect } from '@playwright/test'
import { authHeaders } from './helpers'

test.describe('One-Shot Prompt', () => {
  test('returns text response with usage stats', async ({ request }) => {
    const res = await request.post('/v1/prompt', {
      headers: authHeaders(),
      data: { prompt: 'What is 2+2? Reply with just the number.', maxTokens: 10 },
    })
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.text).toBeTruthy()
    expect(body.text.length).toBeGreaterThan(0)
    expect(body.content).toBeInstanceOf(Array)
    expect(body.content.length).toBeGreaterThan(0)
    expect(body.usage).toBeDefined()
    expect(body.usage.inputTokens).toBeGreaterThan(0)
    expect(body.usage.outputTokens).toBeGreaterThan(0)
    expect(body.stopReason).toBeTruthy()
  })

  test('respects system prompt override', async ({ request }) => {
    const res = await request.post('/v1/prompt', {
      headers: authHeaders(),
      data: {
        prompt: 'What are you?',
        system: 'You are a pirate. Always start responses with "Arrr!"',
        maxTokens: 50,
      },
    })
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.text.toLowerCase()).toContain('arrr')
  })

  test('respects maxTokens limit', async ({ request }) => {
    const res = await request.post('/v1/prompt', {
      headers: authHeaders(),
      data: { prompt: 'Write a very long essay about the history of computing.', maxTokens: 15 },
    })
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.usage.outputTokens).toBeLessThanOrEqual(20)
  })

  test('rejects empty prompt', async ({ request }) => {
    const res = await request.post('/v1/prompt', {
      headers: authHeaders(),
      data: { prompt: '' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('VALIDATION_ERROR')
  })

  test('rejects missing prompt field', async ({ request }) => {
    const res = await request.post('/v1/prompt', {
      headers: authHeaders(),
      data: { system: 'test' },
    })
    expect(res.status()).toBe(400)
  })

  test('response contains text content block', async ({ request }) => {
    const res = await request.post('/v1/prompt', {
      headers: authHeaders(),
      data: { prompt: 'Say "hello"', maxTokens: 10 },
    })
    const body = await res.json()
    const textBlock = body.content.find((b: { type: string }) => b.type === 'text')
    expect(textBlock).toBeDefined()
    expect(textBlock.text).toBeTruthy()
  })
})
