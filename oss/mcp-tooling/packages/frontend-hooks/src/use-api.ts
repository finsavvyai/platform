import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAPIConfig } from './use-domain'
import { useAuth } from './use-auth'

interface APIResponse<T = any> {
  data: T
  message?: string
  success: boolean
  error?: string
}

interface APIState<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
}

interface UseAPIOptions {
  immediate?: boolean
  retry?: number
  retryDelay?: number
  onSuccess?: (data: any) => void
  onError?: (error: string) => void
}

export function useAPI<T = any>(
  endpoint: string,
  options: UseAPIOptions = {}
) {
  const { immediate = true, retry = 3, retryDelay = 1000, onSuccess, onError } = options
  const [state, setState] = useState<APIState<T>>({
    data: null,
    isLoading: immediate,
    error: null,
    lastUpdated: null,
  })

  const { isAuthenticated } = useAuth()
  const apiConfig = useAPIConfig()

  const getAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    const token = localStorage.getItem('auth_token')
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const apiKey = localStorage.getItem('api_key')
    if (apiKey) {
      headers['X-API-Key'] = apiKey
    }

    return headers
  }, [])

  const execute = useCallback(async (
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
    customEndpoint?: string
  ) => {
    const url = customEndpoint || endpoint
    const fullUrl = url.startsWith('http') ? url : `${apiConfig.base}${url}`

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    let attempt = 0
    const maxAttempts = retry + 1

    while (attempt < maxAttempts) {
      try {
        const response = await fetch(fullUrl, {
          method,
          headers: getAuthHeaders(),
          body: data ? JSON.stringify(data) : undefined,
        })

        const responseData: APIResponse<T> = await response.json()

        if (response.ok && responseData.success) {
          setState({
            data: responseData.data,
            isLoading: false,
            error: null,
            lastUpdated: new Date(),
          })
          onSuccess?.(responseData.data)
          return { success: true, data: responseData.data }
        } else {
          const error = responseData.error || `HTTP ${response.status}: ${response.statusText}`
          if (attempt === maxAttempts - 1) {
            setState(prev => ({
              ...prev,
              isLoading: false,
              error,
            }))
            onError?.(error)
            return { success: false, error }
          }
        }
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          const errorMessage = 'Network error occurred'
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: errorMessage,
          }))
          onError?.(errorMessage)
          return { success: false, error: errorMessage }
        }
      }

      attempt++
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
      }
    }

    return { success: false, error: 'Max retries exceeded' }
  }, [endpoint, apiConfig.base, getAuthHeaders, retry, retryDelay, onSuccess, onError])

  const refetch = useCallback(() => {
    return execute('GET')
  }, [execute])

  useEffect(() => {
    if (immediate) {
      execute('GET')
    }
  }, [immediate, execute])

  return {
    ...state,
    execute,
    refetch,
    get: useCallback((data?: any, customEndpoint?: string) =>
      execute('GET', data, customEndpoint), [execute]),
    post: useCallback((data: any, customEndpoint?: string) =>
      execute('POST', data, customEndpoint), [execute]),
    put: useCallback((data: any, customEndpoint?: string) =>
      execute('PUT', data, customEndpoint), [execute]),
    delete: useCallback((customEndpoint?: string) =>
      execute('DELETE', undefined, customEndpoint), [execute]),
  }
}

export function useConnectors() {
  const connectors = useAPI('/v1/connectors')
  const createConnector = useAPI('/v1/connectors', { immediate: false })
  const updateConnector = useAPI('', { immediate: false })
  const deleteConnector = useAPI('', { immediate: false })

  const create = useCallback(async (connectorData: any) => {
    return createConnector.post(connectorData)
  }, [createConnector])

  const update = useCallback(async (id: string, updates: any) => {
    return updateConnector.put(updates, `/v1/connectors/${id}`)
  }, [updateConnector])

  const remove = useCallback(async (id: string) => {
    return deleteConnector.delete(`/v1/connectors/${id}`)
  }, [deleteConnector])

  const deploy = useCallback(async (id: string) => {
    return createConnector.post({}, `/v1/connectors/${id}/deploy`)
  }, [createConnector])

  return {
    ...connectors,
    create,
    update,
    remove,
    deploy,
    isCreating: createConnector.isLoading,
    isUpdating: updateConnector.isLoading,
    isDeleting: deleteConnector.isLoading,
  }
}

export function useParser() {
  const [isParsing, setIsParsing] = useState(false)
  const [parseProgress, setParseProgress] = useState(0)

  const parseOpenAPI = useCallback(async (specContent: string) => {
    setIsParsing(true)
    setParseProgress(0)

    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('api_key')
      const response = await fetch('/api/v1/parser/openapi/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ spec: specContent }),
      })

      const data = await response.json()
      setParseProgress(100)

      if (response.ok && data.success) {
        return { success: true, data: data.data }
      } else {
        return { success: false, error: data.error || 'Parse failed' }
      }
    } catch (error) {
      return { success: false, error: 'Network error occurred' }
    } finally {
      setIsParsing(false)
      setParseProgress(0)
    }
  }, [])

  const parseGraphQL = useCallback(async (schemaContent: string) => {
    setIsParsing(true)
    setParseProgress(0)

    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('api_key')
      const response = await fetch('/api/v1/parser/graphql/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ schema: schemaContent }),
      })

      const data = await response.json()
      setParseProgress(100)

      if (response.ok && data.success) {
        return { success: true, data: data.data }
      } else {
        return { success: false, error: data.error || 'Parse failed' }
      }
    } catch (error) {
      return { success: false, error: 'Network error occurred' }
    } finally {
      setIsParsing(false)
      setParseProgress(0)
    }
  }, [])

  const parsePostman = useCallback(async (collectionContent: string) => {
    setIsParsing(true)
    setParseProgress(0)

    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('api_key')
      const response = await fetch('/api/v1/parser/postman/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ collection: collectionContent }),
      })

      const data = await response.json()
      setParseProgress(100)

      if (response.ok && data.success) {
        return { success: true, data: data.data }
      } else {
        return { success: false, error: data.error || 'Parse failed' }
      }
    } catch (error) {
      return { success: false, error: 'Network error occurred' }
    } finally {
      setIsParsing(false)
      setParseProgress(0)
    }
  }, [])

  return {
    parseOpenAPI,
    parseGraphQL,
    parsePostman,
    isParsing,
    parseProgress,
  }
}

export function useGeneration() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)

  const generate = useCallback(async (
    specData: any,
    options: {
      language?: string
      framework?: string
      runtime?: string
      outputFormat?: string
    } = {}
  ) => {
    setIsGenerating(true)
    setGenerationProgress(0)

    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        throw new Error('Authentication required')
      }

      const response = await fetch('/api/v1/generation/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          spec: specData,
          options,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setGenerationProgress(100)
        return { success: true, jobId: data.jobId }
      } else {
        return { success: false, error: data.error || 'Generation failed' }
      }
    } catch (error) {
      return { success: false, error: 'Network error occurred' }
    } finally {
      setIsGenerating(false)
      setGenerationProgress(0)
    }
  }, [])

  const getStatus = useCallback(async (jobId: string) => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        throw new Error('Authentication required')
      }

      const response = await fetch(`/api/v1/generation/status/${jobId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (response.ok && data.success) {
        return { success: true, status: data.status, progress: data.progress }
      } else {
        return { success: false, error: data.error || 'Status check failed' }
      }
    } catch (error) {
      return { success: false, error: 'Network error occurred' }
    }
  }, [])

  return {
    generate,
    getStatus,
    isGenerating,
    generationProgress,
  }
}