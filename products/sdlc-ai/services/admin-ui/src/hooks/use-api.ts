'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { useDataStore } from '@/store/data'
import type { UseApiResult } from '@/types'

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: any
  headers?: Record<string, string>
  cache?: boolean
  cacheTTL?: number
  retries?: number
  retryDelay?: number
}

export function useApi<T = any>(url: string | null, options: ApiOptions = {}) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const { session } = useAuthStore()
  const { getCache, setCache, clearCache } = useDataStore()

  const {
    method = 'GET',
    body,
    headers = {},
    cache: useCache = true,
    cacheTTL = 5 * 60 * 1000, // 5 minutes
    retries = 3,
    retryDelay = 1000,
  } = options

  const makeRequest = useCallback(
    async (requestUrl?: string, requestOptions?: ApiOptions) => {
      const targetUrl = requestUrl || url
      if (!targetUrl) return

      setLoading(true)
      setError(null)

      // Check cache first for GET requests
      if (method === 'GET' && useCache) {
        const cachedData = getCache(targetUrl)
        if (cachedData) {
          setData(cachedData)
          setLoading(false)
          return cachedData
        }
      }

      let attempt = 0
      let lastError: Error | null = null

      while (attempt < retries) {
        try {
          const fetchOptions: RequestInit = {
            method: requestOptions?.method || method,
            headers: {
              'Content-Type': 'application/json',
              ...(session?.user?.tenantId && {
                'X-Tenant-ID': session.user.tenantId,
              }),
              ...headers,
              ...(requestOptions?.headers || {}),
            },
          }

          if ((requestOptions?.body || body) && (requestOptions?.method || method) !== 'GET') {
            fetchOptions.body = JSON.stringify(requestOptions?.body || body)
          }

          const response = await fetch(targetUrl, fetchOptions)

          if (!response.ok) {
            // Handle authentication errors
            if (response.status === 401) {
              // Token might be expired, try to refresh
              await fetch('/api/auth/refresh')
              // Retry the request once after token refresh
              if (attempt === 0) {
                attempt++
                continue
              }
            }

            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
          }

          const result = await response.json()

          // Cache successful GET requests
          if ((method === 'GET' || requestOptions?.method === 'GET') && useCache) {
            setCache(targetUrl, result, cacheTTL)
          }

          setData(result)
          setError(null)
          return result
        } catch (err) {
          lastError = err instanceof Error ? err : new Error('Unknown error occurred')
          attempt++

          if (attempt < retries) {
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1)))
          }
        }
      }

      setError(lastError)
      throw lastError
    },
    [url, method, body, headers, useCache, cacheTTL, retries, retryDelay, session, getCache, setCache]
  )

  // Initial fetch
  useEffect(() => {
    if (url) {
      makeRequest()
    }
  }, [url, makeRequest])

  // Refetch function
  const refetch = useCallback(() => {
    if (url) {
      return makeRequest()
    }
  }, [url, makeRequest])

  // Mutate function for updating data
  const mutate = useCallback(
    async (newData: T, requestOptions?: ApiOptions) => {
      const result = await makeRequest(undefined, requestOptions)
      setData(newData)
      return result
    },
    [makeRequest]
  )

  // Optimistic update function
  const optimisticUpdate = useCallback(
    async (optimisticData: T, requestOptions?: ApiOptions) => {
      const previousData = data
      setData(optimisticData)

      try {
        const result = await makeRequest(undefined, requestOptions)
        return result
      } catch (error) {
        // Rollback on error
        setData(previousData)
        throw error
      }
    },
    [data, makeRequest]
  )

  // Cancel ongoing request
  const cancel = useCallback(() => {
    // This would need AbortController implementation for proper cancellation
    setLoading(false)
  }, [])

  return {
    data,
    loading,
    error,
    refetch,
    mutate,
    optimisticUpdate,
    cancel,
  }
}

// Hook for paginated data
export function usePaginatedApi<T = any>(baseUrl: string, options: ApiOptions = {}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)

  const url = `${baseUrl}?page=${page}&pageSize=${pageSize}`
  const { data, loading, error, refetch } = useApi<{
    data: T[]
    total: number
    page: number
    pageSize: number
  }>(url, options)

  useEffect(() => {
    if (data) {
      setTotal(data.total)
    }
  }, [data])

  const nextPage = useCallback(() => {
    if (page * pageSize < total) {
      setPage(prev => prev + 1)
    }
  }, [page, pageSize, total])

  const prevPage = useCallback(() => {
    if (page > 1) {
      setPage(prev => prev - 1)
    }
  }, [page])

  const goToPage = useCallback((targetPage: number) => {
    setPage(targetPage)
  }, [])

  const changePageSize = useCallback((newPageSize: number) => {
    setPageSize(newPageSize)
    setPage(1) // Reset to first page when changing page size
  }, [])

  return {
    data: data?.data || [],
    loading,
    error,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    hasNextPage: page * pageSize < total,
    hasPrevPage: page > 1,
    nextPage,
    prevPage,
    goToPage,
    changePageSize,
    refetch,
  }
}

// Hook for real-time data with WebSocket
export function useRealTimeApi<T = any>(url: string, options: ApiOptions = {}) {
  const [data, setData] = useState<T | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const { session } = useAuthStore()

  useEffect(() => {
    if (!url) return

    const wsUrl = url.replace(/^http/, 'ws')
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      setConnected(true)
      setError(null)

      // Send authentication token if available
      if (session?.user) {
        ws.send(JSON.stringify({
          type: 'auth',
          token: session.user.id,
          tenantId: session.user.tenantId,
        }))
      }
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'data') {
          setData(message.payload)
        } else if (message.type === 'error') {
          setError(new Error(message.message))
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err)
      }
    }

    ws.onclose = () => {
      setConnected(false)
    }

    ws.onerror = (event) => {
      setError(new Error('WebSocket connection failed'))
      setConnected(false)
    }

    return () => {
      ws.close()
    }
  }, [url, session])

  const sendMessage = useCallback((message: any) => {
    if (connected) {
      // Implementation depends on WebSocket connection
      console.log('Sending message:', message)
    }
  }, [connected])

  return {
    data,
    connected,
    error,
    sendMessage,
  }
}
