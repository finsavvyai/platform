import { APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'

export const GATEWAY_URL = process.env.CLAW_GATEWAY_URL || 'https://claw-gateway.broad-dew-49ad.workers.dev'
export const PROJECT_ID = 'opensyber'

let cachedKey: string | null = null

export function getApiKey(): string {
  if (cachedKey) return cachedKey
  if (process.env.CLAW_API_KEY) {
    cachedKey = process.env.CLAW_API_KEY
    return cachedKey
  }
  try {
    cachedKey = readFileSync('/tmp/claw-opensyber-key.txt', 'utf-8').trim()
    return cachedKey
  } catch {
    throw new Error('Set CLAW_API_KEY env var or create /tmp/claw-opensyber-key.txt')
  }
}

export function authHeaders() {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    'X-Project-Id': PROJECT_ID,
    'Content-Type': 'application/json',
  }
}

export async function createSession(
  request: APIRequestContext,
  system?: string
): Promise<string> {
  const res = await request.post('/v1/sessions', {
    headers: authHeaders(),
    data: { system },
  })
  const body = await res.json()
  return body.sessionId
}

export async function sendMessage(
  request: APIRequestContext,
  sessionId: string,
  prompt: string,
  maxTokens = 100
): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number }; stopReason: string }> {
  const res = await request.post(`/v1/sessions/${sessionId}/message`, {
    headers: authHeaders(),
    data: { prompt, maxTokens },
  })
  return res.json()
}
