'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Monitor,
  Server,
  Cpu,
  HardDrive,
  Activity,
  CheckCircle,
  AlertCircle,
  XCircle,
} from 'lucide-react'

type ServiceStatus = 'healthy' | 'degraded' | 'down'

interface ServiceInfo {
  name: string
  tech: string
  status: ServiceStatus
  responseMs: number
  lastChecked: string
}

const services: ServiceInfo[] = [
  { name: 'API Gateway', tech: 'Go', status: 'healthy', responseMs: 12, lastChecked: '30s ago' },
  { name: 'RAG Service', tech: 'Python', status: 'healthy', responseMs: 45, lastChecked: '30s ago' },
  { name: 'Vector Core', tech: 'Rust', status: 'healthy', responseMs: 8, lastChecked: '30s ago' },
  { name: 'Admin UI', tech: 'Next.js', status: 'healthy', responseMs: 22, lastChecked: '30s ago' },
  { name: 'Redis', tech: 'Cache', status: 'degraded', responseMs: 67, lastChecked: '1m ago' },
  { name: 'PostgreSQL', tech: 'Database', status: 'healthy', responseMs: 18, lastChecked: '30s ago' },
]

const recentAlerts = [
  { id: 1, severity: 'warning', message: 'Redis latency above 50ms threshold', time: '12 min ago', service: 'Redis' },
  { id: 2, severity: 'info', message: 'Scheduled maintenance window starts in 4 hours', time: '1 hr ago', service: 'All' },
  { id: 3, severity: 'critical', message: 'Vector Core memory usage spike to 92%', time: '3 hrs ago', service: 'Vector Core' },
  { id: 4, severity: 'warning', message: 'RAG Service queue depth above 500', time: '5 hrs ago', service: 'RAG Service' },
  { id: 5, severity: 'info', message: 'API Gateway deployment completed successfully', time: '8 hrs ago', service: 'API Gateway' },
]

function StatusDot({ status }: { status: ServiceStatus }) {
  const colors: Record<ServiceStatus, string> = {
    healthy: 'bg-green-500 dark:bg-green-400',
    degraded: 'bg-amber-500 dark:bg-amber-400',
    down: 'bg-red-500 dark:bg-red-400',
  }
  return <div className={`h-2.5 w-2.5 rounded-full ${colors[status]}`} />
}

function StatusIcon({ status }: { status: ServiceStatus }) {
  if (status === 'healthy') return <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
  if (status === 'degraded') return <AlertCircle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
  return <XCircle className="h-4 w-4 text-destructive" />
}

function alertBadge(severity: string) {
  if (severity === 'critical') return <Badge variant="destructive">Critical</Badge>
  if (severity === 'warning') return <Badge variant="warning">Warning</Badge>
  return <Badge variant="info">Info</Badge>
}

export default function MonitoringPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Monitoring</h1>
          <p className="text-muted-foreground">
            Real-time health, resource usage, and alerts for all platform services.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Uptime</CardTitle>
              <Monitor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">99.97%</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">34%</div>
              <p className="text-xs text-muted-foreground">Avg across all nodes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">6.2 GB</div>
              <p className="text-xs text-muted-foreground">of 16 GB allocated</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,247</div>
              <p className="text-xs text-muted-foreground">+89 in last hour</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-4 w-4" /> Service Health
              </CardTitle>
              <CardDescription>Status of all platform services</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {services.map((svc) => (
                  <div key={svc.name} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <StatusDot status={svc.status} />
                      <div>
                        <p className="text-sm font-medium">{svc.name}</p>
                        <p className="text-xs text-muted-foreground">{svc.tech}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-muted-foreground">{svc.responseMs} ms</span>
                      <span className="text-xs text-muted-foreground">{svc.lastChecked}</span>
                      <StatusIcon status={svc.status} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> Recent Alerts
              </CardTitle>
              <CardDescription>Latest system alerts and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentAlerts.map((alert) => (
                  <div key={alert.id} className="flex items-start gap-3 rounded-lg border p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {alertBadge(alert.severity)}
                        <span className="text-xs text-muted-foreground">{alert.service}</span>
                      </div>
                      <p className="text-sm">{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{alert.time}</p>
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
