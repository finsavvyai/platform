import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useSystemHealth } from '@/store/useDashboardStore'
import { formatDuration, getStatusColor, formatDate } from '@/lib/utils'
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  Zap,
  Database,
  Wifi,
  Server,
  Clock
} from 'lucide-react'
import { SystemHealth, ServiceStatus } from '@/types'

export function SystemHealth() {
  const systemHealth = useSystemHealth()

  if (!systemHealth) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>System Health</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-pulse">
              <Activity className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Loading system health...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'active':
      case 'available':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'degraded':
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      case 'unhealthy':
      case 'inactive':
      case 'unavailable':
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Activity className="h-4 w-4 text-gray-600" />
    }
  }

  const UptimeDisplay = ({ uptime }: { uptime: number }) => {
    const days = Math.floor(uptime / (24 * 60 * 60 * 1000))
    const hours = Math.floor((uptime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    const minutes = Math.floor((uptime % (60 * 60 * 1000)) / (60 * 1000))

    return (
      <div className="flex items-center space-x-4 text-sm">
        <div className="flex items-center space-x-1">
          <span className="text-muted-foreground">Days:</span>
          <span className="font-medium">{days}</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="text-muted-foreground">Hours:</span>
          <span className="font-medium">{hours}</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="text-muted-foreground">Minutes:</span>
          <span className="font-medium">{minutes}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overall System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>System Health</span>
            </div>
            <Badge variant={systemHealth.status === 'healthy' ? 'success' : systemHealth.status === 'degraded' ? 'warning' : 'destructive'}>
              {systemHealth.status.toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Uptime</span>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <UptimeDisplay uptime={systemHealth.uptime} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Response Time (p95)</span>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">
                {formatDuration(systemHealth.response_time_p95)}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Error Rate</span>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">
                {systemHealth.error_rate.toFixed(3)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quantum Backend Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>Quantum Backend Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Status</span>
              <div className="flex items-center space-x-2">
                {getStatusIcon(systemHealth.quantum_backend_status.status)}
                <Badge variant={systemHealth.quantum_backend_status.status === 'available' ? 'success' : systemHealth.quantum_backend_status.status === 'degraded' ? 'warning' : 'destructive'}>
                  {systemHealth.quantum_backend_status.status.toUpperCase()}
                </Badge>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Queue Time</span>
                <div className="text-lg font-semibold">
                  {formatDuration(systemHealth.quantum_backend_status.queue_time)}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Success Rate</span>
                <div className="text-lg font-semibold text-green-600">
                  {systemHealth.quantum_backend_status.success_rate.toFixed(1)}%
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Active Backends</span>
                <div className="text-lg font-semibold">
                  {systemHealth.quantum_backend_status.active_backends.length}
                </div>
              </div>
            </div>

            {systemHealth.quantum_backend_status.active_backends.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Available Backends</span>
                <div className="flex flex-wrap gap-2">
                  {systemHealth.quantum_backend_status.active_backends.map((backend, index) => (
                    <Badge key={index} variant="outline">
                      {backend}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Individual Service Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Server className="h-5 w-5" />
            <span>Service Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {systemHealth.services.map((service, index) => (
              <div key={index} className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(service.status)}
                  <div>
                    <h4 className="font-medium">{service.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {formatDuration(service.response_time)} response time
                    </p>
                    {service.dependencies.length > 0 && (
                      <div className="flex items-center space-x-1 mt-1">
                        <span className="text-xs text-muted-foreground">Depends on:</span>
                        {service.dependencies.map((dep, depIndex) => (
                          <Badge key={depIndex} variant="outline" className="text-xs">
                            {dep}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={service.status === 'healthy' ? 'success' : 'destructive'}>
                    {service.status.toUpperCase()}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(service.last_check)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Additional System Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>Database Health</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Connection Pool</span>
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-20 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: '75%' }} />
                  </div>
                  <span className="text-sm font-medium">75%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Query Performance</span>
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-20 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-500" style={{ width: '60%' }} />
                  </div>
                  <span className="text-sm font-medium">60ms</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active Connections</span>
                <span className="font-medium">42/100</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Wifi className="h-5 w-5" />
              <span>Network Health</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Latency</span>
                <span className="font-medium text-green-600">12ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Packet Loss</span>
                <span className="font-medium">0.1%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Bandwidth</span>
                <span className="font-medium">847 Mbps</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}