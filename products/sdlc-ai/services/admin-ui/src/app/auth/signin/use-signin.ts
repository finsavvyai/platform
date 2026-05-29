'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { useUIStore } from '@/store/ui'

export function useSignIn() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams?.get('callbackUrl') || '/dashboard'
  const error = searchParams?.get('error') || null

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const { login } = useAuthStore()
  const { addNotification } = useUIStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await login(formData.email, formData.password)

      const session = await getSession()
      if (session) {
        addNotification({
          type: 'SUCCESS',
          title: 'Welcome back!',
          message: 'You have successfully signed in.',
        })
        router.push(callbackUrl)
      }
    } catch (err) {
      addNotification({
        type: 'ERROR',
        title: 'Sign in failed',
        message: err instanceof Error ? err.message : 'An unexpected error occurred',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      await signIn('google', { callbackUrl })
    } catch {
      addNotification({
        type: 'ERROR',
        title: 'Sign in failed',
        message: 'Failed to sign in with Google',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGitHubSignIn = async () => {
    setIsLoading(true)
    try {
      await signIn('github', { callbackUrl })
    } catch {
      addNotification({
        type: 'ERROR',
        title: 'Sign in failed',
        message: 'Failed to sign in with GitHub',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return {
    formData,
    setFormData,
    showPassword,
    setShowPassword,
    isLoading,
    error,
    handleSubmit,
    handleGoogleSignIn,
    handleGitHubSignIn,
  }
}
