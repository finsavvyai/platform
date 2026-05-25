'use client'

import { z } from 'zod'
import type { Tenant } from '@/types/user-management'

export const securitySchema = z.object({
  encryptionEnabled: z.boolean(),
  encryptionKeyId: z.string().optional(),
  dataResidency: z.enum(['us', 'eu', 'apac', 'global']),
  auditLogRetention: z.number().min(30).max(2555),
  sessionSecurity: z.object({
    requireIPWhitelist: z.boolean(),
    allowedIPRanges: z.string().optional(),
    enforceGeoFencing: z.boolean(),
    allowedRegions: z.array(z.string()).optional(),
    sessionTimeoutMinutes: z.number().min(5).max(1440),
  }),
  compliance: z.object({
    gdprCompliant: z.boolean(),
    hipaaCompliant: z.boolean(),
    soc2Compliant: z.boolean(),
    pciDssCompliant: z.boolean(),
    dataProcessingAgreement: z.boolean(),
  }),
  backup: z.object({
    enabled: z.boolean(),
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    retentionDays: z.number().min(7).max(365),
    encryptedBackup: z.boolean(),
    crossRegionBackup: z.boolean(),
  }),
  isolation: z.object({
    strictIsolation: z.boolean(),
    sharedResources: z.array(z.string()),
    resourceQuotas: z.object({
      maxCPU: z.number(),
      maxMemory: z.number(),
      maxStorage: z.number(),
      maxAPIRequests: z.number(),
    }),
  }),
})

export type SecurityFormData = z.infer<typeof securitySchema>

export interface SecurityMetric {
  label: string
  value: string | number
  status: 'healthy' | 'warning' | 'critical'
  description: string
}

export interface ComplianceReport {
  framework: string
  status: 'compliant' | 'non-compliant' | 'pending'
  lastAudit: string
  score: number
  issues: Array<{
    severity: 'high' | 'medium' | 'low'
    description: string
    recommendation: string
  }>
}

export interface TenantSecurityPanelProps {
  tenant: Tenant
  onUpdate: (updates: Partial<Tenant>) => void
}
