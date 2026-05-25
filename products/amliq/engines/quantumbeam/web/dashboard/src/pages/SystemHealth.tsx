import React from 'react'
import { SystemHealth as SystemHealthComponent } from '@/components/dashboard/SystemHealth'

export function SystemHealth() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Health</h1>
          <p className="text-muted-foreground">
            Monitor system performance and quantum backend status
          </p>
        </div>
      </div>

      <SystemHealthComponent />
    </div>
  )
}