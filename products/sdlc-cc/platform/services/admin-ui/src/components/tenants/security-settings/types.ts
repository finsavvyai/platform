'use client'

import { z } from 'zod'
import type { Tenant } from '@/types/user-management'

export const securitySettingsSchema = z.object({
  encryption: z.object({
    atRest: z.object({
      enabled: z.boolean(),
      algorithm: z.string(),
      keyRotationDays: z.number().min(1).max(365),
    }),
    inTransit: z.object({
      enforceTLS: z.boolean(),
      minVersion: z.string(),
      cipherSuites: z.array(z.string()),
    }),
    keyManagement: z.object({
      provider: z.string(),
      hsmEnabled: z.boolean(),
      keyIsolation: z.boolean(),
    }),
  }),
  isolation: z.object({
    databaseIsolation: z.boolean(),
    storageIsolation: z.boolean(),
    networkIsolation: z.boolean(),
    computeIsolation: z.boolean(),
    auditTrail: z.boolean(),
  }),
  accessControl: z.object({
    rbacEnabled: z.boolean(),
    ssoEnabled: z.boolean(),
    mfaRequired: z.boolean(),
    sessionTimeout: z.number().min(5).max(1440),
    ipWhitelist: z.string().optional(),
    deviceWhitelist: z.string().optional(),
  }),
  compliance: z.object({
    gdpr: z.boolean(),
    hipaa: z.boolean(),
    soc2: z.boolean(),
    iso27001: z.boolean(),
    dataResidency: z.string(),
    retentionPolicy: z.object({
      enabled: z.boolean(),
      defaultPeriod: z.number().min(30).max(2555),
      legalHold: z.boolean(),
    }),
  }),
})

export type SecuritySettingsFormData = z.infer<typeof securitySettingsSchema>

export interface SecurityAuditLog {
  id: string
  timestamp: string
  action: string
  resource: string
  user: string
  ipAddress: string
  outcome: 'success' | 'failure'
  risk: 'low' | 'medium' | 'high' | 'critical'
  details: string
}

export interface ComplianceReport {
  framework: string
  status: 'compliant' | 'non-compliant' | 'partial'
  score: number
  lastAssessment: string
  findings: Array<{
    category: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    description: string
    recommendation: string
  }>
}

export interface TenantSecuritySettingsProps {
  tenant: Tenant
  onUpdate: (updates: Partial<Tenant>) => void
}
