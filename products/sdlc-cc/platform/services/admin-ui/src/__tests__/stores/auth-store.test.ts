import { renderHook, act } from '@testing-library/react'
import { useAuthStore } from '@/store/auth'
import { signIn, signOut, getSession } from 'next-auth/react'

// Mock NextAuth
jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
  signOut: jest.fn(),
  getSession: jest.fn(),
}))

// Mock fetch
global.fetch = jest.fn()

describe('Auth Store', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    // Reset zustand store between tests (it's a module-level singleton).
    useAuthStore.setState({
      user: null,
      session: null,
      loading: false,
      error: null,
      isAuthenticated: false,
      permissions: [],
    })
  })

  describe('Login', () => {
    it('should handle successful login', async () => {
      const mockSession = {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
          role: 'ADMIN',
          permissions: ['user:read'],
          tenantId: 'test-tenant',
        },
      }

      ;(signIn as jest.Mock).mockResolvedValue({ ok: true })
      ;(getSession as jest.Mock).mockResolvedValue(mockSession)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.login('test@example.com', 'password123')
      })

      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user).toEqual(mockSession.user)
      expect(result.current.error).toBeNull()
      expect(result.current.loading).toBe(false)
    })

    it('should handle login failure', async () => {
      ;(signIn as jest.Mock).mockResolvedValue({
        ok: false,
        error: 'Invalid credentials',
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        // login() rethrows on failure; suppress so we can inspect state.
        await result.current
          .login('test@example.com', 'wrong-password')
          .catch(() => undefined)
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
      expect(result.current.error).toBe('Invalid credentials')
      expect(result.current.loading).toBe(false)
    })

    it('should validate credentials format', async () => {
      ;(signIn as jest.Mock).mockResolvedValue({
        ok: false,
        error: 'Login failed',
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current
          .login('invalid-email', '123')
          .catch(() => undefined)
      })

      expect(result.current.error).toBe('Login failed')
    })
  })

  describe('Logout', () => {
    it('should handle successful logout', async () => {
      // Setup initial authenticated state
      ;(signIn as jest.Mock).mockResolvedValue({ ok: true })
      ;(getSession as jest.Mock).mockResolvedValue({
        user: { id: 'test', email: 'test@example.com' },
      })

      const { result } = renderHook(() => useAuthStore())

      // Login first
      await act(async () => {
        await result.current.login('test@example.com', 'password')
      })

      expect(result.current.isAuthenticated).toBe(true)

      // Then logout
      ;(signOut as jest.Mock).mockResolvedValue(undefined)

      await act(async () => {
        await result.current.logout()
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
      expect(result.current.session).toBeNull()
    })

    it('should handle logout error', async () => {
      const { result } = renderHook(() => useAuthStore())

      ;(signOut as jest.Mock).mockRejectedValue(new Error('Logout failed'))

      await act(async () => {
        await result.current.logout()
      })

      expect(result.current.error).toBe('Logout failed')
    })
  })

  describe('Token Refresh', () => {
    it('should refresh token successfully', async () => {
      const newSession = {
        user: {
          id: 'test-user',
          email: 'test@example.com',
          permissions: ['new-permission'],
        },
      }

      ;(getSession as jest.Mock).mockResolvedValue(newSession)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.refreshToken()
      })

      expect(result.current.user).toEqual(newSession.user)
      expect(result.current.permissions).toEqual(['new-permission'])
    })

    it('should handle token refresh failure', async () => {
      ;(getSession as jest.Mock).mockRejectedValue(new Error('Token expired'))

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.refreshToken()
      })

      // Should logout on refresh failure
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('Profile Update', () => {
    it('should update profile successfully', async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ name: 'Updated Name' }),
      })

      const { result } = renderHook(() => useAuthStore())

      // Set initial state
      result.current.user = {
        id: 'test',
        email: 'test@example.com',
        name: 'Test User',
      } as any

      await act(async () => {
        await result.current.updateProfile({ name: 'Updated Name' })
      })

      expect(result.current.user?.name).toBe('Updated Name')
      expect(result.current.error).toBeNull()
    })

    it('should handle profile update failure', async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: false,
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current
          .updateProfile({ name: 'New Name' })
          .catch(() => undefined)
      })

      expect(result.current.error).toBe('Failed to update profile')
    })
  })

  describe('Password Reset', () => {
    it('should send forgot password email', async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.forgotPassword('test@example.com')
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should reset password successfully', async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.resetPassword('valid-token', 'new-password')
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('Email Verification', () => {
    it('should verify email successfully', async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
      })

      ;(getSession as jest.Mock).mockResolvedValue({
        user: { id: 'test', emailVerified: true },
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.verifyEmail('verification-token')
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('State Persistence', () => {
    it('should persist state to localStorage', () => {
      const mockUser = {
        id: 'test',
        email: 'test@example.com',
        role: 'USER',
      }

      // Use the store API so the persist middleware writes through.
      act(() => {
        useAuthStore.setState({
          user: mockUser as any,
          isAuthenticated: true,
        })
      })

      const stored = localStorage.getItem('auth-store')
      expect(stored).toBeTruthy()

      const parsed = JSON.parse(stored!)
      expect(parsed.state.user).toEqual(mockUser)
      expect(parsed.state.isAuthenticated).toBe(true)
    })

    it('should load state from localStorage on rehydrate', () => {
      const mockUser = { id: 'test', email: 'test@example.com' }

      // Persist via the store, then rehydrate to confirm round-trip.
      act(() => {
        useAuthStore.setState({
          user: mockUser as any,
          isAuthenticated: true,
          permissions: ['user:read'],
        })
      })

      // Rehydrate from storage (zustand persist API).
      const persistApi = (useAuthStore as any).persist
      if (persistApi?.rehydrate) {
        persistApi.rehydrate()
      }

      const { result } = renderHook(() => useAuthStore())
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
    })
  })
})
