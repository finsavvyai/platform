'use client'

import { useEffect } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { Breadcrumb } from '@/components/navigation/breadcrumb'
import { useUIStore } from '@/store/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Zap,
  Brain,
  Server,
  Globe,
  TrendingUp,
  Settings,
} from 'lucide-react'
import { stats, models, routingRules } from './data'

function getModelStatusBadge(status: string) {
  if (status === 'Active') return <Badge variant="default">{status}</Badge>
  if (status === 'Degraded') return <Badge variant="outline" className="border-amber-500 text-amber-500 dark:text-amber-400">{status}</Badge>
  return <Badge variant="destructive">{status}</Badge>
}

function getPriorityBadge(priority: string) {
  if (priority === 'Critical') return <Badge variant="destructive">{priority}</Badge>
  if (priority === 'High') return <Badge variant="default">{priority}</Badge>
  if (priority === 'Medium') return <Badge variant="secondary">{priority}</Badge>
  return <Badge variant="outline">{priority}</Badge>
}

export default function LLMGatewayPage() {
  const { setBreadcrumbs } = useUIStore()

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'LLM Gateway', active: true },
    ])
  }, [setBreadcrumbs])

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <Breadcrumb />
          <div className="mt-4">
            <h1 className="text-2xl font-bold tracking-tight">LLM Gateway</h1>
            <p className="text-muted-foreground">
              Manage model routing, monitor usage, and optimize LLM costs.
            </p>
          </div>
        </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgLatency}</div>
            <p className="text-xs text-muted-foreground">P50 across all models</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Models</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeModels}</div>
            <p className="text-xs text-muted-foreground">In model registry</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.errorRate}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Model Registry</CardTitle>
            <CardDescription>Connected LLM providers and their performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {models.map((model) => (
                <div key={model.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{model.name}</span>
                    </div>
                    {getModelStatusBadge(model.status)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <p>Provider: <span className="text-foreground">{model.provider}</span></p>
                    <p>Requests/day: <span className="text-foreground">{model.requestsPerDay.toLocaleString()}</span></p>
                    <p>Avg latency: <span className="text-foreground">{model.avgLatency}</span></p>
                    <p>Cost/1K: <span className="text-foreground">{model.costPer1K}</span></p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Settings className="h-3 w-3 mr-1" />
                    Configure
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Routing Rules</CardTitle>
            <CardDescription>Intelligent request routing configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {routingRules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full ${rule.active ? 'bg-green-500 dark:bg-green-400' : 'bg-gray-300 dark:bg-gray-600'}`} />
                    <p className="text-sm truncate">{rule.rule}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {getPriorityBadge(rule.priority)}
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
