'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Puzzle,
} from 'lucide-react'

const bundles = [
  { name: 'tenant-isolation', version: '2.4.1', status: 'active', updated: '2026-03-06' },
  { name: 'data-access-control', version: '1.8.0', status: 'active', updated: '2026-03-05' },
  { name: 'api-rate-limits', version: '3.1.2', status: 'active', updated: '2026-03-04' },
  { name: 'compliance-gdpr', version: '1.2.0', status: 'draft', updated: '2026-03-03' },
]

const evaluations = [
  { decision: 'allow', policy: 'tenant-isolation', input: 'GET /api/v1/documents (tenant: acme)', duration: '0.8ms', time: '14:32:01' },
  { decision: 'deny', policy: 'data-access-control', input: 'DELETE /api/v1/users/42 (role: viewer)', duration: '1.2ms', time: '14:31:58' },
  { decision: 'allow', policy: 'api-rate-limits', input: 'POST /api/v1/search (tenant: globex)', duration: '0.5ms', time: '14:31:45' },
  { decision: 'deny', policy: 'compliance-gdpr', input: 'EXPORT /api/v1/pii (region: EU)', duration: '2.1ms', time: '14:31:30' },
  { decision: 'allow', policy: 'tenant-isolation', input: 'PUT /api/v1/settings (tenant: acme)', duration: '0.7ms', time: '14:31:12' },
]

export default function OpaPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">OPA Policy Engine</h1>
          <p className="text-muted-foreground">
            Open Policy Agent configuration, bundles, and evaluation logs.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Policies</CardTitle>
              <Puzzle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {bundles.filter((b) => b.status === 'active').length}
              </div>
              <p className="text-xs text-muted-foreground">
                {bundles.length} total bundles
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Evaluations/min</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8,421</div>
              <p className="text-xs text-muted-foreground">+6.3% from last hour</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Allow Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">94.2%</div>
              <p className="text-xs text-muted-foreground">Requests permitted</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Deny Rate</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">5.8%</div>
              <p className="text-xs text-muted-foreground">Requests blocked</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> Policy Bundles
              </CardTitle>
              <CardDescription>Managed OPA policy bundles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {bundles.map((b) => (
                  <div
                    key={b.name}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium font-mono">{b.name}</span>
                      <p className="text-xs text-muted-foreground">
                        v{b.version} &middot; Updated {b.updated}
                      </p>
                    </div>
                    <Badge
                      variant={b.status === 'active' ? 'default' : 'secondary'}
                    >
                      {b.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> Recent Evaluations
              </CardTitle>
              <CardDescription>Latest policy evaluation results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {evaluations.map((ev, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    {ev.decision === 'allow' ? (
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500 dark:text-green-400" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={ev.decision === 'allow' ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {ev.decision.toUpperCase()}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                          {ev.policy}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {ev.input}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ev.duration} &middot; {ev.time}
                      </p>
                    </div>
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
