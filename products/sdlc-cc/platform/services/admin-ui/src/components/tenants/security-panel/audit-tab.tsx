'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Download } from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'
import { SecurityFormData } from './types'

interface AuditTabProps {
  form: UseFormReturn<SecurityFormData>
  isExportingData: boolean
  onExportAuditLogs: () => void
}

const mockAuditEvents = [
  { event: 'User role modified', user: 'admin@example.com', timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), ip: '192.168.1.100' },
  { event: 'Security settings updated', user: 'security@example.com', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), ip: '192.168.1.101' },
  { event: 'Encryption key rotated', user: 'system', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), ip: 'system' },
]

export function AuditTab({ form, isExportingData, onExportAuditLogs }: AuditTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium">Audit Logs</h4>
          <p className="text-xs text-muted-foreground">Track all activities and changes within your tenant</p>
        </div>
        <Button variant="outline" onClick={onExportAuditLogs} disabled={isExportingData}>
          <Download className="h-4 w-4 mr-2" />
          {isExportingData ? 'Exporting...' : 'Export Logs'}
        </Button>
      </div>

      <FormField control={form.control} name="auditLogRetention"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Log Retention Period (days)</FormLabel>
            <FormControl>
              <Input type="number" min="30" max="2555" {...field}
                onChange={(e) => field.onChange(parseInt(e.target.value))} />
            </FormControl>
            <FormDescription>How long to retain audit logs (minimum 30 days)</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="space-y-3">
        <h5 className="text-sm font-medium">Recent Audit Events</h5>
        <div className="space-y-2">
          {mockAuditEvents.map((event, index) => (
            <div key={index} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{event.event}</p>
                <p className="text-xs text-muted-foreground">by {event.user} from {event.ip}</p>
              </div>
              <div className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
