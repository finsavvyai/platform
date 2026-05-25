'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import type { Tenant } from '@/types/user-management'
import { SecurityMetric } from './types'
import { getStatusIcon, getStatusColor } from './helpers'

interface OverviewTabProps {
  securityMetrics: SecurityMetric[]
  tenant: Tenant
}

export function OverviewTab({ securityMetrics, tenant }: OverviewTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {securityMetrics.map((metric, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(metric.status)}
                  <span className="text-sm font-medium">{metric.label}</span>
                </div>
                <Badge variant="outline" className={getStatusColor(metric.status)}>
                  {metric.value}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{metric.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      <div>
        <h4 className="text-sm font-medium mb-3">Resource Quotas</h4>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>CPU Usage</span>
              <span>{tenant.usage.users} / {tenant.limits.users} vCPUs</span>
            </div>
            <Progress value={(tenant.usage.users / tenant.limits.users) * 100} />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Storage</span>
              <span>{tenant.usage.storage}GB / {tenant.limits.storage}GB</span>
            </div>
            <Progress value={(tenant.usage.storage / tenant.limits.storage) * 100} />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>API Requests</span>
              <span>{tenant.usage.apiCalls} / {tenant.limits.apiCalls}</span>
            </div>
            <Progress value={(tenant.usage.apiCalls / tenant.limits.apiCalls) * 100} />
          </div>
        </div>
      </div>
    </div>
  )
}
