/**
 * Minimal fetch wrapper for the gateway API.
 *
 * Auth strategy: matches `src/lib/api-client.ts` — pull `accessToken` and
 * `tenantId` from the next-auth session at `/api/auth/session`. We could
 * import `apiClient` from there directly, but TanStack Query mutations want
 * a thin Promise<T> primitive, not the class instance. This module exposes
 * `apiFetch<T>` and a typed `ApiError`.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

interface SessionShape {
  accessToken?: string
  user?: { tenantId?: string }
}

let cachedSession: SessionShape | null = null
let cachedAt = 0
const SESSION_TTL_MS = 30_000

async function getSession(): Promise<SessionShape> {
  if (cachedSession && Date.now() - cachedAt < SESSION_TTL_MS) {
    return cachedSession
  }
  try {
    const res = await fetch('/api/auth/session', { credentials: 'include' })
    if (!res.ok) {
      cachedSession = {}
    } else {
      cachedSession = (await res.json()) as SessionShape
    }
  } catch {
    cachedSession = {}
  }
  cachedAt = Date.now()
  return cachedSession
}

/** Reset session cache — primarily for tests. */
export function __resetSessionCacheForTests() {
  cachedSession = null
  cachedAt = 0
}

async function buildHeaders(extra?: HeadersInit): Promise<Headers> {
  const headers = new Headers(extra)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const session = await getSession()
  if (session.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`)
  if (session.user?.tenantId) headers.set('X-Tenant-ID', session.user.tenantId)

  return headers
}

/**
 * Performs a fetch against the gateway. Resolves with the parsed JSON body.
 * Throws ApiError on non-2xx responses; the parsed problem+json body is
 * attached as `error.body`.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`
  const headers = await buildHeaders(init.headers)

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
  })

  // 204 No Content — return undefined as T (callers typed accordingly).
  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  let parsed: unknown = undefined
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }

  if (!response.ok) {
    const message =
      (parsed && typeof parsed === 'object' && 'detail' in parsed && typeof (parsed as Record<string, unknown>).detail === 'string'
        ? ((parsed as Record<string, unknown>).detail as string)
        : undefined) ||
      (parsed && typeof parsed === 'object' && 'message' in parsed && typeof (parsed as Record<string, unknown>).message === 'string'
        ? ((parsed as Record<string, unknown>).message as string)
        : undefined) ||
      `HTTP ${response.status}: ${response.statusText}`
    throw new ApiError(message, response.status, parsed)
  }

  return parsed as T
}

export const API_BASE = API_BASE_URL
