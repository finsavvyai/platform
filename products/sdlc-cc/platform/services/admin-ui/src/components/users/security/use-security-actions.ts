'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/components/ui/use-toast'
import type { User } from '@/types/user-management'
import type { SecurityEvent, SecurityMetrics, SecurityFormData } from './types'

export function useSecurityActions(user: User, onUpdate: (updates: Partial<User>) => void) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([])
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetrics | null>(null)
  const [isResettingMFA, setIsResettingMFA] = useState(false)
  const [isSendingResetLink, setIsSendingResetLink] = useState(false)
  const [isImpersonating, setIsImpersonating] = useState(false)

  const fetchSecurityData = useCallback(async () => {
    try {
      const mockEvents: SecurityEvent[] = [
        {
          id: '1', type: 'LOGIN_SUCCESS',
          description: 'Successful login from Chrome on Windows',
          ipAddress: '192.168.1.100', location: 'New York, US',
          device: 'Chrome 119 / Windows 10',
          timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
          risk: 'low',
        },
        {
          id: '2', type: 'LOGIN_FAILED',
          description: 'Failed login attempt - incorrect password',
          ipAddress: '185.220.101.10', location: 'Unknown',
          device: 'Unknown',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          risk: 'medium',
        },
      ]
      const mockMetrics: SecurityMetrics = {
        failedLogins: 3, successfulLogins: 127, uniqueIPs: 5,
        riskScore: 25,
        lastSecurityScan: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        vulnerabilities: [],
      }
      setSecurityEvents(mockEvents)
      setSecurityMetrics(mockMetrics)
    } catch (error) {
      console.error('Failed to fetch security data:', error)
    }
  }, [])

  useEffect(() => { fetchSecurityData() }, [fetchSecurityData])

  const handleSecurityUpdate = async (data: SecurityFormData) => {
    setIsLoading(true)
    try {
      await fetch(`/api/users/${user.id}/security`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      toast({ title: 'Security settings updated', description: 'User security settings have been updated successfully.' })
      onUpdate({ ...user, mfaEnabled: data.enforceMFA })
    } catch (error) {
      toast({ title: 'Failed to update security settings', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetMFA = async () => {
    setIsResettingMFA(true)
    try {
      await fetch(`/api/users/${user.id}/reset-mfa`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      toast({ title: 'MFA reset', description: 'MFA has been reset. User will need to set it up again.' })
      onUpdate({ ...user, mfaEnabled: false })
    } catch (error) {
      toast({ title: 'Failed to reset MFA', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' })
    } finally {
      setIsResettingMFA(false)
    }
  }

  const handleSendPasswordReset = async () => {
    setIsSendingResetLink(true)
    try {
      await fetch(`/api/users/${user.id}/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      toast({ title: 'Password reset sent', description: `Password reset link has been sent to ${user.email}` })
    } catch (error) {
      toast({ title: 'Failed to send reset link', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' })
    } finally {
      setIsSendingResetLink(false)
    }
  }

  const handleImpersonateUser = async () => {
    setIsImpersonating(true)
    try {
      const response = await fetch(`/api/admin/impersonate/${user.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      if (response.ok) {
        const { impersonationToken } = await response.json()
        document.cookie = `impersonation_token=${impersonationToken}; path=/; secure; httponly; samesite=strict`
        toast({ title: 'Impersonation started', description: `You are now impersonating ${user.name}` })
        window.open(`/dashboard?impersonate=${user.id}`, '_blank')
      }
    } catch (error) {
      toast({ title: 'Failed to start impersonation', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' })
    } finally {
      setIsImpersonating(false)
    }
  }

  return {
    isLoading, securityEvents, securityMetrics,
    isResettingMFA, isSendingResetLink, isImpersonating,
    handleSecurityUpdate, handleResetMFA, handleSendPasswordReset, handleImpersonateUser,
  }
}
