'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Activity, CheckCircle2, XCircle } from 'lucide-react'
import { SecurityAuditLog } from './types'
import { getComplianceStatusColor } from './helpers'

interface AuditTabProps {
  auditLogs: SecurityAuditLog[]
}

export function AuditTab({ auditLogs }: AuditTabProps) {
  return (
    <div className="space-y-3">
      {auditLogs.map((log) => (
        <div key={log.id} className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{log.action}</p>
              <p className="text-xs text-muted-foreground">{log.user} - {log.ipAddress}</p>
              <p className="text-xs text-muted-foreground">{log.details}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1">
              {log.outcome === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <Badge variant="outline" className={getComplianceStatusColor(log.risk)}>{log.risk}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{new Date(log.timestamp).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
