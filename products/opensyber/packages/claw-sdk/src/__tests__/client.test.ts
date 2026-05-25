import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClawClient } from '../client.js'
import { buildHeaders } from '../http.js'

describe('ClawClient', () => {
  const baseConfig = {
    projectId: 'test-project',
    apiKey: 'test-api-key-123',
    endpoint: 'https://claw.test.dev',
  }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('uses default provider and model when not specified', () => {
      const client = new ClawClient(baseConfig)
      expect(client).toBeDefined()
    })

    it('resolves model aliases', () => {
      const client = new ClawClient({ ...baseConfig, model: 'opus' })
      expect(client).toBeDefined()
    })
  })

  describe('prompt', () => {
    it('sends correct request structure', async () => {
      const mockResponse = {
        sessionId: 's-123',
        text: 'Hello!',
        content: [{ type: 'text', text: 'Hello!' }],
        usage: { inputTokens: 10, outputTokens: 5 },
        stopReason: 'end_turn',
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const client = new ClawClient(baseConfig)
      const result = await client.prompt('Say hello')

      expect(result.text).toBe('Hello!')
      expect(result.usage.inputTokens).toBe(10)

      const fetchCall = vi.mocked(fetch).mock.calls[0]
      expect(fetchCall?.[0]).toBe('https://claw.test.dev/v1/prompt')

      const body = JSON.parse(fetchCall?.[1]?.body as string)
      expect(body.prompt).toBe('Say hello')
      expect(body.provider).toBe('anthropic')
    })

    it('throws on error response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ code: 'RATE_LIMITED', message: 'Too many requests' }),
          { status: 429 }
        )
      )

      const client = new ClawClient(baseConfig)
      await expect(client.prompt('test')).rejects.toThrow('RATE_LIMITED')
    })
  })

  describe('ask', () => {
    it('returns just the text', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sessionId: 's-1',
            text: 'The answer is 42',
            content: [{ type: 'text', text: 'The answer is 42' }],
            usage: { inputTokens: 5, outputTokens: 8 },
            stopReason: 'end_turn',
          }),
          { status: 200 }
        )
      )

      const client = new ClawClient(baseConfig)
      const text = await client.ask('What is the answer?')
      expect(text).toBe('The answer is 42')
    })
  })

  describe('createSession', () => {
    it('returns a ClawSession with correct ID', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ sessionId: 'sess-abc' }), {
          status: 200,
        })
      )

      const client = new ClawClient(baseConfig)
      const session = await client.createSession()
      expect(session.id).toBe('sess-abc')
    })
  })

  describe('resumeSession', () => {
    it('creates a session with the given ID without fetch', () => {
      const client = new ClawClient(baseConfig)
      const session = client.resumeSession('existing-id')
      expect(session.id).toBe('existing-id')
    })
  })

  describe('ping', () => {
    it('returns true on 200', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('ok', { status: 200 })
      )

      const client = new ClawClient(baseConfig)
      expect(await client.ping()).toBe(true)
    })

    it('returns false on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('Network error')
      )

      const client = new ClawClient(baseConfig)
      expect(await client.ping()).toBe(false)
    })
  })
})

describe('buildHeaders', () => {
  it('includes auth and project headers', () => {
    const headers = buildHeaders({
      projectId: 'my-project',
      apiKey: 'secret-key',
      endpoint: 'https://test.dev',
    })

    expect(headers['Authorization']).toBe('Bearer secret-key')
    expect(headers['X-Project-Id']).toBe('my-project')
    expect(headers['Content-Type']).toBe('application/json')
  })
})
