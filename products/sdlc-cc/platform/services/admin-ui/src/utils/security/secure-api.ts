// Secure API client wrapper
import { apiClient } from '@/lib/api-client'

interface ApiEnvelopeResponse<T> {
  data: T
  status: number
  message?: string
}

class SecureApiClient {
  async get<T>(url: string, options?: { params?: Record<string, unknown> }): Promise<ApiEnvelopeResponse<T>> {
    const result = await apiClient.get<T>(url, options?.params)
    return { data: result, status: 200 }
  }

  async post<T>(url: string, data?: unknown, options?: Record<string, unknown>): Promise<ApiEnvelopeResponse<T>> {
    const result = await apiClient.post<T>(url, data)
    return { data: result, status: 200 }
  }

  async put<T>(url: string, data?: unknown, options?: Record<string, unknown>): Promise<ApiEnvelopeResponse<T>> {
    const result = await apiClient.put<T>(url, data)
    return { data: result, status: 200 }
  }

  async patch<T>(url: string, data?: unknown, options?: Record<string, unknown>): Promise<ApiEnvelopeResponse<T>> {
    const result = await apiClient.patch<T>(url, data)
    return { data: result, status: 200 }
  }

  async delete<T>(url: string, options?: Record<string, unknown>): Promise<ApiEnvelopeResponse<T>> {
    const result = await apiClient.delete<T>(url)
    return { data: result, status: 200 }
  }
}

export const secureApiClient = new SecureApiClient()
export default secureApiClient

// Decorators / HOFs for services
export function withEncryption<T>(fn: (...args: unknown[]) => Promise<T>): (...args: unknown[]) => Promise<T> {
  return fn
}

export function withAuditLogging<T>(fn: (...args: unknown[]) => Promise<T>): (...args: unknown[]) => Promise<T> {
  return fn
}

export function withRateLimiting<T>(fn: (...args: unknown[]) => Promise<T>): (...args: unknown[]) => Promise<T> {
  return fn
}

export const secureCache = {
  get: (key: string): unknown => null,
  set: (key: string, value: unknown, ttl?: number): void => {},
  delete: (key: string): void => {},
  clear: (): void => {},
}
