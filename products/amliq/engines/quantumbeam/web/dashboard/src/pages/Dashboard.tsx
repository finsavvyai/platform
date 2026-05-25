import React from 'react'
import { MetricsOverview } from '@/components/dashboard/MetricsOverview'

export function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time fraud detection and system metrics overview
          </p>
        </div>
      </div>

      <MetricsOverview />
    </div>
  )
}