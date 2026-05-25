'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Server,
  CheckCircle,
  AlertCircle,
  XCircle,
  Globe,
  Clock,
} from 'lucide-react'

const services = [
  {
    name: 'API Gateway',
    stack: 'Go',
    status: 'healthy',
    uptime: 99.98,
    endpoint: 'https://gateway.sdlc.ai',
    lastDeployed: '2026-03-06 14:32 UTC',
  },
  {
    name: 'RAG Service',
    stack: 'Python',
    status: 'healthy',
    uptime: 99.95,
    endpoint: 'https://rag.sdlc.ai',
    lastDeployed: '2026-03-05 09:15 UTC',
  },
  {
    name: 'Vector Core',
    stack: 'Rust',
    status: 'degraded',
    uptime: 98.72,
    endpoint: 'https://vector.sdlc.ai',
    lastDeployed: '2026-03-04 18:45 UTC',
  },
  {
    name: 'Admin UI',
    stack: 'Next.js',
    status: 'healthy',
    uptime: 99.99,
    endpoint: 'https://admin.sdlc.ai',
    lastDeployed: '2026-03-07 08:00 UTC',
  },
  {
    name: 'DLP Service',
    stack: 'Python',
    status: 'healthy',
    uptime: 99.91,
    endpoint: 'https://dlp.sdlc.ai',
    lastDeployed: '2026-03-03 12:20 UTC',
  },
  {
    name: 'LLM Gateway',
    stack: 'Go',
    status: 'down',
    uptime: 94.30,
    endpoint: 'https://llm.sdlc.ai',
    lastDeployed: '2026-03-01 22:10 UTC',
  },
]

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'healthy':
      return <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
    case 'degraded':
      return <AlertCircle className="h-5 w-5 text-amber-500 dark:text-amber-400" />
    case 'down':
      return <XCircle className="h-5 w-5 text-destructive" />
    default:
      return <AlertCircle className="h-5 w-5 text-muted-foreground" />
  }
}

function statusDot(status: string) {
  switch (status) {
    case 'healthy':
      return 'bg-green-500 dark:bg-green-400'
    case 'degraded':
      return 'bg-amber-500 dark:bg-amber-400'
    case 'down':
      return 'bg-red-500 dark:bg-red-400'
    default:
      return 'bg-slate-400 dark:bg-slate-500'
  }
}

const healthy = services.filter((s) => s.status === 'healthy').length
const degraded = services.filter((s) => s.status === 'degraded').length
const down = services.filter((s) => s.status === 'down').length

export default function ServicesPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Service Registry</h1>
          <p className="text-muted-foreground">
            Monitor and manage all platform microservices.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Services</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{services.length}</div>
              <p className="text-xs text-muted-foreground">Registered in platform</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Healthy</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{healthy}</div>
              <p className="text-xs text-muted-foreground">Operating normally</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Degraded</CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{degraded}</div>
              <p className="text-xs text-muted-foreground">Partial issues detected</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Down</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{down}</div>
              <p className="text-xs text-muted-foreground">Requires attention</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((svc) => (
            <Card key={svc.name}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{svc.name}</CardTitle>
                  <StatusIcon status={svc.status} />
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{svc.stack}</Badge>
                  <div className={`h-2 w-2 rounded-full ${statusDot(svc.status)}`} />
                  <span className="text-xs capitalize text-muted-foreground">
                    {svc.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Uptime</span>
                  <span className="font-medium">{svc.uptime}%</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" />
                  <span className="truncate font-mono text-xs">{svc.endpoint}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-xs">{svc.lastDeployed}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
