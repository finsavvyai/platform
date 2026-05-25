'use client'

import React from 'react'
import { CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react'

export function getStatusIcon(status: string) {
  switch (status) {
    case 'healthy':
    case 'compliant':
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'warning':
    case 'pending':
      return <AlertCircle className="h-4 w-4 text-yellow-500" />
    case 'critical':
    case 'non-compliant':
      return <XCircle className="h-4 w-4 text-red-500" />
    default:
      return <Info className="h-4 w-4 text-gray-500" />
  }
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'healthy':
    case 'compliant':
      return 'text-green-600 bg-green-50'
    case 'warning':
    case 'pending':
      return 'text-yellow-600 bg-yellow-50'
    case 'critical':
    case 'non-compliant':
      return 'text-red-600 bg-red-50'
    default:
      return 'text-gray-600 bg-gray-50'
  }
}

export const defaultFormValues = {
  encryptionEnabled: true,
  encryptionKeyId: '',
  dataResidency: 'us' as const,
  auditLogRetention: 365,
  sessionSecurity: {
    requireIPWhitelist: false,
    allowedIPRanges: '',
    enforceGeoFencing: false,
    allowedRegions: [],
    sessionTimeoutMinutes: 60,
  },
  compliance: {
    gdprCompliant: false,
    hipaaCompliant: false,
    soc2Compliant: false,
    pciDssCompliant: false,
    dataProcessingAgreement: false,
  },
  backup: {
    enabled: true,
    frequency: 'daily' as const,
    retentionDays: 30,
    encryptedBackup: true,
    crossRegionBackup: false,
  },
  isolation: {
    strictIsolation: true,
    sharedResources: [],
    resourceQuotas: {
      maxCPU: 4,
      maxMemory: 8192,
      maxStorage: 100,
      maxAPIRequests: 10000,
    },
  },
}
