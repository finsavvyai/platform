import { z } from 'zod'
import type { User } from '@/types/user-management'

export const securitySchema = z.object({
  enforceMFA: z.boolean(),
  passwordPolicy: z.object({
    minLength: z.number().min(8).max(128),
    requireUppercase: z.boolean(),
    requireLowercase: z.boolean(),
    requireNumbers: z.boolean(),
    requireSpecialChars: z.boolean(),
    preventReuse: z.number().min(0).max(24),
    expirationDays: z.number().min(0).max(365),
  }),
  sessionTimeout: z.number().min(5).max(1440),
  maxConcurrentSessions: z.number().min(1).max(10),
  ipWhitelist: z.string().optional(),
  allowedDevices: z.string().optional(),
  securityNotifications: z.object({
    emailOnNewDevice: z.boolean(),
    emailOnFailedLogin: z.boolean(),
    emailOnPasswordChange: z.boolean(),
    smsOnCriticalActions: z.boolean(),
  }),
})

export type SecurityFormData = z.infer<typeof securitySchema>

export interface SecurityEvent {
  id: string
  type:
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILED'
    | 'PASSWORD_CHANGE'
    | 'MFA_ENABLED'
    | 'MFA_DISABLED'
    | 'SECURITY_SETTING_CHANGED'
  description: string
  ipAddress: string
  location: string
  device: string
  timestamp: string
  risk: 'low' | 'medium' | 'high' | 'critical'
}

export interface SecurityMetrics {
  failedLogins: number
  successfulLogins: number
  uniqueIPs: number
  riskScore: number
  lastSecurityScan: string
  vulnerabilities: Array<{
    type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    description: string
  }>
}

export interface UserSecurityPanelProps {
  user: User
  onUpdate: (updates: Partial<User>) => void
}

export const SECURITY_FORM_DEFAULTS: SecurityFormData = {
  enforceMFA: false,
  passwordPolicy: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventReuse: 5,
    expirationDays: 90,
  },
  sessionTimeout: 60,
  maxConcurrentSessions: 3,
  ipWhitelist: '',
  allowedDevices: '',
  securityNotifications: {
    emailOnNewDevice: true,
    emailOnFailedLogin: true,
    emailOnPasswordChange: true,
    smsOnCriticalActions: false,
  },
}

export function getRiskColor(risk: string): string {
  switch (risk) {
    case 'low':
      return 'text-green-600 bg-green-50'
    case 'medium':
      return 'text-yellow-600 bg-yellow-50'
    case 'high':
      return 'text-orange-600 bg-orange-50'
    case 'critical':
      return 'text-red-600 bg-red-50'
    default:
      return 'text-gray-600 bg-gray-50'
  }
}
