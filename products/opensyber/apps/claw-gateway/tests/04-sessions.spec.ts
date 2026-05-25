import { test, expect } from '@playwright/test'
import { authHeaders, createSession, sendMessage } from './helpers'

test.describe('Session Lifecycle', () => {
  test('creates a session and returns UUID', async ({ request }) => {
    const res = await request.post('/v1/sessions', {
      headers: authHeaders(),
      data: { system: 'You are a test assistant.' },
    })
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.sessionId).toBeTruthy()
    expect(body.sessionId).toMatch(/^[0-9a-f-]{36}$/)
  })

  test('multi-turn conversation retains context', async ({ request }) => {
    const sessionId = await createSession(request, 'Remember: the secret word is "platypus". Only say it when asked.')

    const turn1 = await sendMessage(request, sessionId, 'What topics can you help with?', 50)
    expect(turn1.text).toBeTruthy()
    expect(turn1.text.toLowerCase()).not.toContain('platypus')

    const turn2 = await sendMessage(request, sessionId, 'What is the secret word?', 30)
    expect(turn2.text.toLowerCase()).toContain('platypus')
  })

  test('session info returns metadata', async ({ request }) => {
    const sessionId = await createSession(request)
    await sendMessage(request, sessionId, 'Hello', 10)

    const res = await request.get(`/v1/sessions/${sessionId}/info`, {
      headers: authHeaders(),
    })
    expect(res.status()).toBe(200)

    const info = await res.json()
    expect(info.id).toBe(sessionId)
    expect(info.projectId).toBe('opensyber')
    expect(info.status).toBe('active')
    expect(info.messageCount).toBeGreaterThanOrEqual(2)
    expect(info.totalInputTokens).toBeGreaterThan(0)
    expect(info.totalOutputTokens).toBeGreaterThan(0)
  })

  test('session messages returns conversation history', async ({ request }) => {
    const sessionId = await createSession(request)
    await sendMessage(request, sessionId, 'First message', 10)
    await sendMessage(request, sessionId, 'Second message', 10)

    const res = await request.get(`/v1/sessions/${sessionId}`, {
      headers: authHeaders(),
    })
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.messages).toBeInstanceOf(Array)
    expect(body.messages.length).toBeGreaterThanOrEqual(4)

    const roles = body.messages.map((m: { role: string }) => m.role)
    expect(roles).toContain('user')
    expect(roles).toContain('assistant')
  })

  test('session compact reduces message count', async ({ request }) => {
    const sessionId = await createSession(request)

    for (let i = 0; i < 3; i++) {
      await sendMessage(request, sessionId, `Message number ${i + 1}`, 10)
    }

    const beforeRes = await request.get(`/v1/sessions/${sessionId}`, { headers: authHeaders() })
    const before = await beforeRes.json()
    const beforeCount = before.messages.length

    const compactRes = await request.post(`/v1/sessions/${sessionId}/compact`, {
      headers: authHeaders(),
    })
    expect(compactRes.status()).toBe(200)

    const afterRes = await request.get(`/v1/sessions/${sessionId}`, { headers: authHeaders() })
    const after = await afterRes.json()
    expect(after.messages.length).toBeLessThanOrEqual(beforeCount)
  })

  test('session close marks session as closed', async ({ request }) => {
    const sessionId = await createSession(request)

    const closeRes = await request.delete(`/v1/sessions/${sessionId}`, {
      headers: authHeaders(),
    })
    expect(closeRes.status()).toBe(200)

    const infoRes = await request.get(`/v1/sessions/${sessionId}/info`, {
      headers: authHeaders(),
    })
    const info = await infoRes.json()
    expect(info.status).toBe('closed')
  })

  test('list sessions endpoint returns successfully', async ({ request }) => {
    await createSession(request)

    const res = await request.get('/v1/sessions', { headers: authHeaders() })
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.sessions).toBeInstanceOf(Array)
  })
})
