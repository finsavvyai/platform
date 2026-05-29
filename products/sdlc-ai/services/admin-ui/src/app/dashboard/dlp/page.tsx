'use client'

import { useEffect } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { Breadcrumb } from '@/components/navigation/breadcrumb'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useUIStore } from '@/store/ui'
import { Shield, Eye, AlertTriangle, Lock, FileSearch, Ban } from 'lucide-react'

const recentDetections = [
  { id: '1', type: 'SSN', source: 'API Request /v1/users', action: 'Masked', time: '2 min ago' },
  { id: '2', type: 'Credit Card', source: 'File Upload report.csv', action: 'Blocked', time: '15 min ago' },
  { id: '3', type: 'Email', source: 'Log Output worker-3', action: 'Allowed', time: '32 min ago' },
  { id: '4', type: 'Phone', source: 'API Request /v1/contacts', action: 'Masked', time: '1 hr ago' },
  { id: '5', type: 'SSN', source: 'Database Export tenant-42', action: 'Blocked', time: '2 hr ago' },
  { id: '6', type: 'Credit Card', source: 'Webhook Payload billing', action: 'Blocked', time: '3 hr ago' },
]

const dlpRules = [
  { id: '1', name: 'SSN Detection', pattern: 'XXX-XX-XXXX', enabled: true, matches: 142 },
  { id: '2', name: 'Credit Card Numbers', pattern: 'Luhn Algorithm', enabled: true, matches: 89 },
  { id: '3', name: 'Email Address PII', pattern: 'RFC 5322', enabled: true, matches: 1247 },
  { id: '4', name: 'Phone Numbers', pattern: 'E.164 Format', enabled: false, matches: 56 },
  { id: '5', name: 'API Key Leakage', pattern: 'sk-*, pk-*, key_*', enabled: true, matches: 23 },
]

function getActionBadge(action: string) {
  switch (action) {
    case 'Blocked':
      return <Badge variant="destructive">{action}</Badge>
    case 'Masked':
      return <Badge variant="default">{action}</Badge>
    case 'Allowed':
      return <Badge variant="secondary">{action}</Badge>
    default:
      return <Badge variant="outline">{action}</Badge>
  }
}

export default function DlpPage() {
  const { setBreadcrumbs } = useUIStore()

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Data Loss Prevention', active: true },
    ])
  }, [setBreadcrumbs])

  const blockedCount = recentDetections.filter((d) => d.action === 'Blocked').length
  const activeRules = dlpRules.filter((r) => r.enabled).length

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <Breadcrumb />
          <div className="mt-4">
            <h1 className="text-2xl font-bold tracking-tight">Data Loss Prevention</h1>
            <p className="text-muted-foreground">
              Monitor and prevent sensitive data exposure across your platform
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Scans Today</CardTitle>
              <FileSearch className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12,847</div>
              <p className="text-xs text-muted-foreground">+8% from yesterday</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">PII Detected</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">234</div>
              <p className="text-xs text-muted-foreground">Across all channels</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Blocked Transfers</CardTitle>
              <Ban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{blockedCount}</div>
              <p className="text-xs text-muted-foreground">Prevented data leaks</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeRules}</div>
              <p className="text-xs text-muted-foreground">of {dlpRules.length} total rules</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Recent Detections
              </CardTitle>
              <CardDescription>Latest PII and sensitive data detections</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentDetections.map((detection) => (
                  <div key={detection.id} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{detection.type}</Badge>
                        {getActionBadge(detection.action)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {detection.source}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                      {detection.time}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                DLP Rules
              </CardTitle>
              <CardDescription>Active detection and prevention rules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dlpRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{rule.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Pattern: {rule.pattern} &middot; {rule.matches} matches
                      </p>
                    </div>
                    <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
