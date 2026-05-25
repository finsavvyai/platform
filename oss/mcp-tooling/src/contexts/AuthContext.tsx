import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { UserPreferences, ActivityItem } from '../types/database'
import {
  RateLimiter,
  CSRFProtection,
  InputSanitizer,
  SessionManager,
  SecurityLogger,
  RATE_LIMITS,
} from '../lib/security'

// Helper function to get user-friendly error messages
const getErrorMessage = (error: { message?: string }): string => {
  switch (error.message) {
    case 'Invalid login credentials':
      return 'Invalid email or password. Please check your credentials and try again.'
    case 'User already registered':
      return 'An account with this email already exists. Please sign in or use a different email.'
    case 'Password should be at least 6 characters':
      return 'Password must be at least 6 characters long.'
    case 'Email rate limit exceeded':
      return 'Too many requests. Please wait a moment before trying again.'
    case 'Invalid email':
      return 'Please enter a valid email address.'
    case 'Signup requires a valid password':
      return 'Password is required and must be at least 6 characters long.'
    default:
      return error.message || 'An error occurred. Please try again.'
  }
}

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<{ success: boolean; message: string; needsVerification?: boolean }>
  signIn: (email: string, password: string) => Promise<{ success: boolean; message: string }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ success: boolean; message: string }>
  updatePassword: (newPassword: string) => Promise<{ success: boolean; message: string }>
  resendVerification: (email: string) => Promise<{ success: boolean; message: string }>
  updateProfile: (updates: {
    display_name?: string
    avatar_url?: string
  }) => Promise<{ success: boolean; message: string }>
  updatePreferences: (
    preferences: Partial<UserPreferences>
  ) => Promise<{ success: boolean; message: string }>
  deleteAccount: () => Promise<{ success: boolean; message: string }>
  getUserActivity: () => Promise<ActivityItem[]>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Handle password reset flow from URL hash
    const handlePasswordReset = async () => {
      const hash = window.location.hash
      if (hash.includes('access_token')) {
        const { error } = await supabase.auth.getSession()
        if (error) {
          console.error('Error handling password reset:', error)
        }
      }
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)

      // Handle password reset confirmation
      if (_event === 'PASSWORD_RECOVERY') {
        // User has clicked the password reset link
        window.location.hash = 'reset-password'
      }
    })

    // Handle initial URL hash for password reset
    handlePasswordReset()

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string, displayName?: string) => {
    try {
      // Apply rate limiting
      const rateLimiter = new RateLimiter('authentication', RATE_LIMITS.authentication)
      const rateLimitResult = await rateLimiter.checkLimit(email)

      if (!rateLimitResult.allowed) {
        SecurityLogger.logEvent({
          type: 'rate_limit_exceeded',
          details: {
            action: 'sign_up',
            email: email,
          },
        })

        return {
          success: false,
          message: `Too many registration attempts. Please try again in ${Math.ceil(
            (rateLimitResult.resetTime - Date.now()) / 60000
          )} minutes.`,
        }
      }

      // Validate and sanitize inputs
      const sanitizedEmail = InputSanitizer.sanitizeEmail(email)
      if (!sanitizedEmail) {
        SecurityLogger.logEvent({
          type: 'invalid_input',
          details: {
            action: 'sign_up',
            field: 'email',
            value: email,
          },
        })

        return {
          success: false,
          message: 'Please enter a valid email address.',
        }
      }

      const passwordValidation = InputSanitizer.validatePassword(password)
      if (!passwordValidation.valid) {
        SecurityLogger.logEvent({
          type: 'invalid_input',
          details: {
            action: 'sign_up',
            field: 'password',
            errors: passwordValidation.errors,
          },
        })

        return {
          success: false,
          message: passwordValidation.errors.join('. '),
        }
      }

      const sanitizedDisplayName = InputSanitizer.sanitizeDisplayName(
        displayName || email.split('@')[0]
      )

      const { data, error } = await supabase.auth.signUp({
        email: sanitizedEmail,
        password,
        options: {
          data: {
            display_name: sanitizedDisplayName,
          },
        },
      })

      if (error) {
        SecurityLogger.logEvent({
          type: 'auth_failure',
          details: {
            action: 'sign_up',
            email: sanitizedEmail,
            error: error.message,
          },
        })

        return {
          success: false,
          message: getErrorMessage(error),
        }
      }

      // Check if user needs email verification
      if (data.user && !data.user.email_confirmed_at) {
        return {
          success: true,
          message: 'Account created successfully! Please check your email to verify your account.',
          needsVerification: true,
        }
      }

      return {
        success: true,
        message: 'Account created successfully!',
        needsVerification: false,
      }
    } catch (error) {
      SecurityLogger.logEvent({
        type: 'auth_failure',
        details: {
          action: 'sign_up',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      })

      return {
        success: false,
        message: 'An unexpected error occurred. Please try again.',
      }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      // Apply rate limiting
      const rateLimiter = new RateLimiter('authentication', RATE_LIMITS.authentication)
      const rateLimitResult = await rateLimiter.checkLimit(email)

      if (!rateLimitResult.allowed) {
        SecurityLogger.logEvent({
          type: 'rate_limit_exceeded',
          details: {
            action: 'sign_in',
            email: email,
          },
        })

        return {
          success: false,
          message: `Too many sign in attempts. Please try again in ${Math.ceil(
            (rateLimitResult.resetTime - Date.now()) / 60000
          )} minutes.`,
        }
      }

      // Validate and sanitize inputs
      const sanitizedEmail = InputSanitizer.sanitizeEmail(email)
      if (!sanitizedEmail) {
        SecurityLogger.logEvent({
          type: 'invalid_input',
          details: {
            action: 'sign_in',
            field: 'email',
            value: email,
          },
        })

        return {
          success: false,
          message: 'Please enter a valid email address.',
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password,
      })

      if (error) {
        SecurityLogger.logEvent({
          type: 'auth_failure',
          details: {
            action: 'sign_in',
            email: sanitizedEmail,
            error: error.message,
          },
        })

        return {
          success: false,
          message: getErrorMessage(error),
        }
      }

      // Check if email is not verified
      if (data.user && !data.user.email_confirmed_at) {
        return {
          success: false,
          message:
            'Please verify your email address before signing in. Check your inbox for the verification link.',
        }
      }

      // Initialize session timeout management
      if (data.session) {
        SessionManager.initialize(
          2 * 60 * 60 * 1000, // 2 hours
          () => {
            // Session timeout callback
            SecurityLogger.logEvent({
              type: 'session_timeout',
              details: {
                userId: data.user?.id,
                sessionExpiry: data.session?.expires_at,
              },
            })
            signOut()
          },
          () => {
            // Session warning callback (5 minutes before timeout)
            // You could show a warning toast or modal here
            console.warn('Session will expire in 5 minutes')
          }
        )
      }

      return {
        success: true,
        message: 'Successfully signed in!',
      }
    } catch (error) {
      SecurityLogger.logEvent({
        type: 'auth_failure',
        details: {
          action: 'sign_in',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      })

      return {
        success: false,
        message: 'An unexpected error occurred. Please try again.',
      }
    }
  }

  const signOut = async () => {
    try {
      // Clear session timeout
      SessionManager.clearTimeout()

      // Clear CSRF token
      CSRFProtection.clearToken()

      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (err) {
      console.error('Sign out error:', err)
    }
  }

  const resetPassword = async (email: string) => {
    try {
      // Apply rate limiting for password reset
      const rateLimiter = new RateLimiter('passwordReset', RATE_LIMITS.passwordReset)
      const rateLimitResult = await rateLimiter.checkLimit(email)

      if (!rateLimitResult.allowed) {
        SecurityLogger.logEvent({
          type: 'rate_limit_exceeded',
          details: {
            action: 'reset_password',
            email: email,
          },
        })

        return {
          success: false,
          message: `Too many password reset attempts. Please try again in ${Math.ceil(
            (rateLimitResult.resetTime - Date.now()) / 60000
          )} minutes.`,
        }
      }

      // Validate and sanitize email
      const sanitizedEmail = InputSanitizer.sanitizeEmail(email)
      if (!sanitizedEmail) {
        SecurityLogger.logEvent({
          type: 'invalid_input',
          details: {
            action: 'reset_password',
            field: 'email',
            value: email,
          },
        })

        return {
          success: false,
          message: 'Please enter a valid email address.',
        }
      }

      const { error } = await supabase.auth.resetPasswordForEmail(sanitizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        SecurityLogger.logEvent({
          type: 'auth_failure',
          details: {
            action: 'reset_password',
            email: sanitizedEmail,
            error: error.message,
          },
        })

        return {
          success: false,
          message: getErrorMessage(error),
        }
      }

      return {
        success: true,
        message: 'Password reset instructions have been sent to your email address.',
      }
    } catch (error) {
      SecurityLogger.logEvent({
        type: 'auth_failure',
        details: {
          action: 'reset_password',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      })

      return {
        success: false,
        message: 'An unexpected error occurred. Please try again.',
      }
    }
  }

  const updatePassword = async (newPassword: string) => {
    try {
      // Validate password strength
      const passwordValidation = InputSanitizer.validatePassword(newPassword)
      if (!passwordValidation.valid) {
        SecurityLogger.logEvent({
          type: 'invalid_input',
          details: {
            action: 'update_password',
            field: 'password',
            errors: passwordValidation.errors,
          },
        })

        return {
          success: false,
          message: passwordValidation.errors.join('. '),
        }
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        SecurityLogger.logEvent({
          type: 'auth_failure',
          details: {
            action: 'update_password',
            userId: user?.id,
            error: error.message,
          },
        })

        return {
          success: false,
          message: getErrorMessage(error),
        }
      }

      return {
        success: true,
        message: 'Password updated successfully!',
      }
    } catch (error) {
      SecurityLogger.logEvent({
        type: 'auth_failure',
        details: {
          action: 'update_password',
          userId: user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      })

      return {
        success: false,
        message: 'An unexpected error occurred. Please try again.',
      }
    }
  }

  const resendVerification = async (email: string) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      })

      if (error) {
        return {
          success: false,
          message: getErrorMessage(error),
        }
      }

      return {
        success: true,
        message: 'Verification email has been resent. Please check your inbox.',
      }
    } catch {
      return {
        success: false,
        message: 'An unexpected error occurred. Please try again.',
      }
    }
  }

  const updateProfile = async (updates: { display_name?: string; avatar_url?: string }) => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: updates,
      })

      if (error) {
        return {
          success: false,
          message: getErrorMessage(error),
        }
      }

      return {
        success: true,
        message: 'Profile updated successfully!',
      }
    } catch {
      return {
        success: false,
        message: 'An unexpected error occurred. Please try again.',
      }
    }
  }

  const updatePreferences = async (preferences: Partial<UserPreferences>) => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          preferences,
        },
      })

      if (error) {
        return {
          success: false,
          message: getErrorMessage(error),
        }
      }

      return {
        success: true,
        message: 'Preferences updated successfully!',
      }
    } catch {
      return {
        success: false,
        message: 'An unexpected error occurred. Please try again.',
      }
    }
  }

  const deleteAccount = async () => {
    try {
      // First, delete user data from custom tables
      const { error: dataError } = await supabase
        .from('connectors')
        .delete()
        .eq('owner_id', user?.id)

      if (dataError) {
        throw new Error('Failed to delete user data')
      }

      // Then delete the user account
      const { error } = await supabase.auth.admin.deleteUser(user?.id || '')

      if (error) {
        return {
          success: false,
          message: 'Failed to delete account. Please contact support.',
        }
      }

      return {
        success: true,
        message: 'Account deleted successfully.',
      }
    } catch {
      return {
        success: false,
        message: 'An unexpected error occurred. Please try again.',
      }
    }
  }

  const getUserActivity = async (): Promise<ActivityItem[]> => {
    try {
      if (!user) return []

      // Get recent connectors
      const { data: connectors } = await supabase
        .from('connectors')
        .select('id, name, created_at, updated_at')
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(10)

      // Get recent jobs
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, type, status, created_at, finished_at')
        .eq('connector_id', user.id) // This will need to be adjusted based on actual schema
        .order('created_at', { ascending: false })
        .limit(10)

      const activities: ActivityItem[] = []

      // Add connector activities
      connectors?.forEach(connector => {
        activities.push({
          id: `connector-${connector.id}`,
          type: 'connector_updated',
          description: `Updated connector "${connector.name}"`,
          timestamp: connector.updated_at,
          metadata: { connectorId: connector.id, connectorName: connector.name },
        })
      })

      // Add job activities
      jobs?.forEach(job => {
        activities.push({
          id: `job-${job.id}`,
          type: job.status === 'completed' ? 'job_completed' : 'user_updated',
          description: `${job.type} job ${job.status}`,
          timestamp: job.finished_at || job.created_at,
          metadata: { jobId: job.id, status: job.status },
        })
      })

      // Sort by timestamp descending
      return activities.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
    } catch {
      return []
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signUp,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        resendVerification,
        updateProfile,
        updatePreferences,
        deleteAccount,
        getUserActivity,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
