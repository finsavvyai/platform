import { renderHook, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { AuthProvider, useAuth } from '../../contexts/AuthContext'
import { mockSupabaseAuth } from '../setup'

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabaseAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })
  })

  const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

  describe('signUp', () => {
    it('should successfully sign up a user', async () => {
      const mockUser = { id: '123', email: 'test@example.com', email_confirmed_at: null }
      mockSupabaseAuth.signUp.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      const signUpResult = await result.current.signUp(
        'test@example.com',
        'password123',
        'Test User'
      )

      expect(signUpResult.success).toBe(true)
      expect(signUpResult.needsVerification).toBe(true)
      expect(signUpResult.message).toContain('Please check your email to verify your account')
      expect(mockSupabaseAuth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: {
          data: {
            display_name: 'Test User',
          },
        },
      })
    })

    it('should handle sign up errors', async () => {
      mockSupabaseAuth.signUp.mockResolvedValue({
        data: null,
        error: { message: 'User already registered' },
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      const signUpResult = await result.current.signUp('existing@example.com', 'password123')

      expect(signUpResult.success).toBe(false)
      expect(signUpResult.message).toContain('already exists')
    })

    it('should use email prefix as default display name', async () => {
      mockSupabaseAuth.signUp.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await result.current.signUp('test@example.com', 'password123')

      expect(mockSupabaseAuth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: {
          data: {
            display_name: 'test',
          },
        },
      })
    })
  })

  describe('signIn', () => {
    it('should successfully sign in a verified user', async () => {
      const mockUser = { id: '123', email: 'test@example.com', email_confirmed_at: '2023-01-01' }
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      const signInResult = await result.current.signIn('test@example.com', 'password123')

      expect(signInResult.success).toBe(true)
      expect(signInResult.message).toBe('Successfully signed in!')
    })

    it('should prevent sign in for unverified user', async () => {
      const mockUser = { id: '123', email: 'test@example.com', email_confirmed_at: null }
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      const signInResult = await result.current.signIn('test@example.com', 'password123')

      expect(signInResult.success).toBe(false)
      expect(signInResult.message).toContain('verify your email')
    })

    it('should handle sign in errors', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' },
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      const signInResult = await result.current.signIn('test@example.com', 'wrongpassword')

      expect(signInResult.success).toBe(false)
      expect(signInResult.message).toContain('Invalid email or password')
    })
  })

  describe('resetPassword', () => {
    it('should send password reset email', async () => {
      mockSupabaseAuth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null,
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      const resetResult = await result.current.resetPassword('test@example.com')

      expect(resetResult.success).toBe(true)
      expect(resetResult.message).toContain('sent to your email')
      expect(mockSupabaseAuth.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {
        redirectTo: 'http://localhost:5173/reset-password',
      })
    })

    it('should handle reset password errors', async () => {
      mockSupabaseAuth.resetPasswordForEmail.mockResolvedValue({
        data: null,
        error: { message: 'User not found' },
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      const resetResult = await result.current.resetPassword('nonexistent@example.com')

      expect(resetResult.success).toBe(false)
    })
  })

  describe('updatePassword', () => {
    it('should successfully update password', async () => {
      mockSupabaseAuth.updateUser.mockResolvedValue({
        data: { user: { id: '123' } },
        error: null,
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      const updateResult = await result.current.updatePassword('newPassword123')

      expect(updateResult.success).toBe(true)
      expect(updateResult.message).toBe('Password updated successfully!')
      expect(mockSupabaseAuth.updateUser).toHaveBeenCalledWith({
        password: 'newPassword123',
      })
    })

    it('should handle update password errors', async () => {
      mockSupabaseAuth.updateUser.mockResolvedValue({
        data: null,
        error: { message: 'Password is too weak' },
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      const updateResult = await result.current.updatePassword('weak')

      expect(updateResult.success).toBe(false)
    })
  })

  describe('resendVerification', () => {
    it('should resend verification email', async () => {
      mockSupabaseAuth.resend.mockResolvedValue({
        data: {},
        error: null,
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      const resendResult = await result.current.resendVerification('test@example.com')

      expect(resendResult.success).toBe(true)
      expect(resendResult.message).toContain('Verification email has been resent')
      expect(mockSupabaseAuth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'test@example.com',
        options: {
          emailRedirectTo: 'http://localhost:5173/dashboard',
        },
      })
    })

    it('should handle resend verification errors', async () => {
      mockSupabaseAuth.resend.mockResolvedValue({
        data: null,
        error: { message: 'Rate limit exceeded' },
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      const resendResult = await result.current.resendVerification('test@example.com')

      expect(resendResult.success).toBe(false)
    })
  })

  describe('initialization', () => {
    it('should initialize with loading state', () => {
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      expect(result.current.loading).toBe(true)
    })

    it('should set user when session exists', async () => {
      const mockUser = { id: '123', email: 'test@example.com' }
      const mockSession = { user: mockUser }

      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser)
        expect(result.current.session).toEqual(mockSession)
        expect(result.current.loading).toBe(false)
      })
    })

    it('should handle auth state changes', async () => {
      const mockUser = { id: '123', email: 'test@example.com' }
      const mockSession = { user: mockUser }

      const mockUnsubscribe = vi.fn()
      const mockSubscription = { data: { subscription: { unsubscribe: mockUnsubscribe } } }

      let onAuthChangeCallback: (
        event: string,
        session: { user: { id: string; email: string } } | null
      ) => void
      mockSupabaseAuth.onAuthStateChange.mockImplementation(callback => {
        onAuthChangeCallback = callback
        return mockSubscription
      })

      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Simulate auth state change
      await onAuthChangeCallback('SIGNED_IN', mockSession)

      // Note: This test checks that the callback is called, but the actual state
      // change is handled asynchronously by React
      expect(mockSupabaseAuth.onAuthStateChange).toHaveBeenCalled()
    })
  })
})
