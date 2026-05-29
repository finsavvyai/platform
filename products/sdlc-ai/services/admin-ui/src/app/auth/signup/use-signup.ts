'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { useUIStore } from '@/store/ui'

interface SignupFormData {
  name: string
  email: string
  password: string
  confirmPassword: string
  acceptTerms: boolean
}

export function useSignup() {
  const router = useRouter()
  const { register } = useAuthStore()
  const { addNotification } = useUIStore()

  const [formData, setFormData] = useState<SignupFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = 'Name is required'
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long'
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }
    if (!formData.acceptTerms) {
      newErrors.acceptTerms = 'You must accept the terms and conditions'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return { strength: 0, text: '', color: '' }
    let strength = 0
    if (password.length >= 8) strength++
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
    if (/\d/.test(password)) strength++
    if (/[^a-zA-Z\d]/.test(password)) strength++
    const map: Record<number, { text: string; color: string }> = {
      0: { text: 'Very weak', color: 'bg-destructive' },
      1: { text: 'Weak', color: 'bg-orange-500' },
      2: { text: 'Fair', color: 'bg-amber-500' },
      3: { text: 'Good', color: 'bg-blue-500' },
      4: { text: 'Strong', color: 'bg-emerald-500' },
    }
    return { strength, ...map[strength] }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setIsLoading(true)
    try {
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      })
      addNotification({
        type: 'SUCCESS',
        title: 'Account created!',
        message: 'Your account has been created successfully. Please check your email to verify your account.',
      })
      router.push('/auth/signin?message=signup-success')
    } catch (error) {
      addNotification({
        type: 'ERROR',
        title: 'Sign up failed',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return {
    formData,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    isLoading,
    errors,
    passwordStrength: getPasswordStrength(formData.password),
    handleInputChange,
    handleSubmit,
  }
}
