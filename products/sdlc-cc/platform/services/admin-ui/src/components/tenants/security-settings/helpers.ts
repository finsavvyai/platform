'use client'

import { SecuritySettingsFormData } from './types'

export function getComplianceStatusColor(status: string) {
  switch (status) {
    case 'compliant': return 'text-green-600 bg-green-50'
    case 'non-compliant': return 'text-red-600 bg-red-50'
    case 'partial': return 'text-yellow-600 bg-yellow-50'
    default: return 'text-gray-600 bg-gray-50'
  }
}

export function getSecurityScore(data: SecuritySettingsFormData): number {
  let score = 0
  if (data.encryption.atRest.enabled) score += 20
  if (data.encryption.inTransit.enforceTLS) score += 15
  if (data.encryption.keyManagement.hsmEnabled) score += 15
  if (data.isolation.databaseIsolation) score += 10
  if (data.isolation.storageIsolation) score += 10
  if (data.accessControl.rbacEnabled) score += 10
  if (data.accessControl.ssoEnabled) score += 5
  if (data.accessControl.mfaRequired) score += 10
  if (data.compliance.gdpr) score += 5
  return score
}

export const defaultFormValues: SecuritySettingsFormData = {
  encryption: {
    atRest: { enabled: true, algorithm: 'AES-256-GCM', keyRotationDays: 90 },
    inTransit: { enforceTLS: true, minVersion: '1.3', cipherSuites: ['TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256'] },
    keyManagement: { provider: 'aws-kms', hsmEnabled: true, keyIsolation: true },
  },
  isolation: { databaseIsolation: true, storageIsolation: true, networkIsolation: true, computeIsolation: false, auditTrail: true },
  accessControl: { rbacEnabled: true, ssoEnabled: false, mfaRequired: true, sessionTimeout: 60, ipWhitelist: '', deviceWhitelist: '' },
  compliance: { gdpr: true, hipaa: false, soc2: false, iso27001: false, dataResidency: 'us-east-1', retentionPolicy: { enabled: true, defaultPeriod: 2555, legalHold: true } },
}
