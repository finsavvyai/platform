'use client'

import { cn } from '@/lib/utils'
import { getRiskColor } from './types'
import type { SecurityEvent } from './types'

interface SecurityActivityTabProps {
  securityEvents: SecurityEvent[]
}

export function SecurityActivityTab({ securityEvents }: SecurityActivityTabProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {securityEvents.map((event) => (
          <div
            key={event.id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'px-2 py-1 rounded text-xs font-medium',
                  getRiskColor(event.risk)
                )}
              >
                {event.risk.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium">{event.description}</p>
                <p className="text-xs text-muted-foreground">
                  {event.ipAddress} - {event.location} - {event.device}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                {new Date(event.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
