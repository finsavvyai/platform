import type { ClawConfig, ClawError } from './types.js'

/** Build standard headers for gateway requests */
export function buildHeaders(
  config: ClawConfig
): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
    'X-Project-Id': config.projectId,
  }
}

/** Construct a full URL from base endpoint and path */
export function buildUrl(endpoint: string, path: string): string {
  const base = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint
  return `${base}${path}`
}

/** Parse an error response into a typed ClawError */
export async function handleErrorResponse(
  response: Response
): Promise<Error> {
  let errorData: ClawError | null = null

  try {
    errorData = (await response.json()) as ClawError
  } catch {
    // Response body not JSON — use status text
  }

  const message = errorData?.message ?? response.statusText
  const code = errorData?.code ?? `HTTP_${response.status}`
  const error = new Error(`[${code}] ${message}`)
  error.name = 'ClawError'
  return error
}
