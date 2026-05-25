import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/router'
import { useAPIConfig } from './use-domain'

interface User {
  id: string
  email: string
  name: string
  avatar?: string
  role: 'user' | 'admin' | 'developer'
  createdAt: string
  lastLoginAt: string
}

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
}

interface LoginCredentials {
  email: string
  password: string
}

interface RegisterCredentials {
  email: string
  password: string
  name: string
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  })

  const router = useRouter()
  const apiConfig = useAPIConfig()

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        setState(prev => ({ ...prev, isLoading: false }))
        return
      }

      const response = await fetch(`${apiConfig.auth}/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const userData = await response.json()
        setState({
          user: userData.user,
          isLoading: false,
          isAuthenticated: true,
          error: null,
        })
      } else {
        localStorage.removeItem('auth_token')
        setState(prev => ({ ...prev, isLoading: false }))
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Authentication check failed'
      }))
    }
  }, [apiConfig.auth])

  const login = useCallback(async (credentials: LoginCredentials) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await fetch(`${apiConfig.auth}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      const data = await response.json()

      if (response.ok) {
        localStorage.setItem('auth_token', data.token)
        setState({
          user: data.user,
          isLoading: false,
          isAuthenticated: true,
          error: null,
        })
        return { success: true, user: data.user }
      } else {
        const error = data.error || 'Login failed'
        setState(prev => ({
          ...prev,
          isLoading: false,
          error
        }))
        return { success: false, error }
      }
    } catch (error) {
      const errorMessage = 'Network error occurred'
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }))
      return { success: false, error: errorMessage }
    }
  }, [apiConfig.auth])

  const register = useCallback(async (credentials: RegisterCredentials) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await fetch(`${apiConfig.auth}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      const data = await response.json()

      if (response.ok) {
        localStorage.setItem('auth_token', data.token)
        setState({
          user: data.user,
          isLoading: false,
          isAuthenticated: true,
          error: null,
        })
        return { success: true, user: data.user }
      } else {
        const error = data.error || 'Registration failed'
        setState(prev => ({
          ...prev,
          isLoading: false,
          error
        }))
        return { success: false, error }
      }
    } catch (error) {
      const errorMessage = 'Network error occurred'
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }))
      return { success: false, error: errorMessage }
    }
  }, [apiConfig.auth])

  const logout = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (token) {
        await fetch(`${apiConfig.auth}/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('auth_token')
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      })
      router.push('/')
    }
  }, [apiConfig.auth, router])

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    const token = localStorage.getItem('auth_token')
    if (!token || !state.user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      const response = await fetch(`${apiConfig.auth}/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      const data = await response.json()

      if (response.ok) {
        setState(prev => ({
          ...prev,
          user: { ...prev.user!, ...data.user },
        }))
        return { success: true, user: data.user }
      } else {
        const error = data.error || 'Profile update failed'
        return { success: false, error }
      }
    } catch (error) {
      const errorMessage = 'Network error occurred'
      return { success: false, error: errorMessage }
    }
  }, [apiConfig.auth, state.user])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  return {
    ...state,
    login,
    register,
    logout,
    updateProfile,
    clearError,
    refetch: checkAuthStatus,
  }
}

export function useAuthGuard(required?: boolean) {
  const { isAuthenticated, isLoading } = useAuth()

  return {
    isAllowed: !required || isAuthenticated,
    isLoading,
  }
}

export function useRequireAuth() {
  const auth = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      router.push('/login')
    }
  }, [auth.isLoading, auth.isAuthenticated, router])

  return auth.isAuthenticated && !auth.isLoading
}

export function useAPIKey() {
  const [apiKey, setAPIKey] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const storedKey = localStorage.getItem('api_key')
    if (storedKey) {
      setAPIKey(storedKey)
    }
  }, [])

  const setKey = useCallback((key: string) => {
    setAPIKey(key)
    localStorage.setItem('api_key', key)
    setError(null)
  }, [])

  const clearKey = useCallback(() => {
    setAPIKey(null)
    localStorage.removeItem('api_key')
    setError(null)
  }, [])

  const validateKey = useCallback(async (key: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/v1/validate-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
      })

      if (response.ok) {
        setKey(key)
        return { success: true }
      } else {
        const data = await response.json()
        const errorMessage = data.error || 'Invalid API key'
        setError(errorMessage)
        return { success: false, error: errorMessage }
      }
    } catch (error) {
      const errorMessage = 'Network error occurred'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }, [setKey])

  return {
    apiKey,
    setKey,
    clearKey,
    validateKey,
    isLoading,
    error,
    isValid: !!apiKey,
  }
}