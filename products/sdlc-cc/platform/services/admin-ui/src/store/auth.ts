import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { signOut, signIn, getSession } from 'next-auth/react'
import type { AuthState, RegisterData } from './types'

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // State
      user: null,
      session: null,
      loading: false,
      error: null,
      isAuthenticated: false,
      permissions: [],

      // Actions
      login: async (email: string, password: string) => {
        set({ loading: true, error: null })

        try {
          const result = await signIn('credentials', {
            email,
            password,
            redirect: false,
          })

          if (result?.error) {
            set({ error: result.error, loading: false })
            throw new Error(result.error)
          }

          if (result?.ok) {
            const session = await getSession()
            if (session) {
              set({
                session: session as any,
                user: session.user as any,
                isAuthenticated: true,
                permissions: (session.user as any).permissions as string[],
                loading: false,
                error: null,
              })
            }
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Login failed',
            loading: false,
          })
          throw error
        }
      },

      logout: async () => {
        set({ loading: true })

        try {
          await signOut({ redirect: false })
          set({
            user: null,
            session: null,
            isAuthenticated: false,
            permissions: [],
            loading: false,
            error: null,
          })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Logout failed',
            loading: false,
          })
        }
      },

      register: async (data: RegisterData) => {
        set({ loading: true, error: null })

        try {
          const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.message || 'Registration failed')
          }

          const result = await response.json()

          // Auto-login after successful registration
          await get().login(data.email, data.password)
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Registration failed',
            loading: false,
          })
          throw error
        }
      },

      refreshToken: async () => {
        try {
          const session = await getSession()
          if (session) {
            set({
              session: session as any,
              user: session.user as any,
              isAuthenticated: true,
              permissions: (session.user as any).permissions as string[],
            })
          }
        } catch (error) {
          console.error('Failed to refresh token:', error)
          await get().logout()
        }
      },

      updateProfile: async (data) => {
        set({ loading: true, error: null })

        try {
          const response = await fetch('/api/user/profile', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          })

          if (!response.ok) {
            throw new Error('Failed to update profile')
          }

          const updatedUser = await response.json()
          set(state => ({
            user: { ...state.user, ...updatedUser },
            loading: false,
          }))
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update profile',
            loading: false,
          })
          throw error
        }
      },

      forgotPassword: async (email: string) => {
        set({ loading: true, error: null })

        try {
          const response = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
          })

          if (!response.ok) {
            throw new Error('Failed to send reset email')
          }

          set({ loading: false })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to send reset email',
            loading: false,
          })
          throw error
        }
      },

      resetPassword: async (token: string, password: string) => {
        set({ loading: true, error: null })

        try {
          const response = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token, password }),
          })

          if (!response.ok) {
            throw new Error('Failed to reset password')
          }

          set({ loading: false })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to reset password',
            loading: false,
          })
          throw error
        }
      },

      verifyEmail: async (token: string) => {
        set({ loading: true, error: null })

        try {
          const response = await fetch('/api/auth/verify-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token }),
          })

          if (!response.ok) {
            throw new Error('Failed to verify email')
          }

          // Refresh user session after verification
          await get().refreshToken()
          set({ loading: false })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to verify email',
            loading: false,
          })
          throw error
        }
      },
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        isAuthenticated: state.isAuthenticated,
        permissions: state.permissions,
      }),
    }
  )
)
