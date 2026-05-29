'use client'

import { useEffect } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { Breadcrumb } from '@/components/navigation/breadcrumb'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useUIStore } from '@/store/ui'
import { Key, Plus, Copy, Trash2, RefreshCw, Shield } from 'lucide-react'

const apiKeys = [
  { id: '1', name: 'Production Gateway', key: 'sk-prod-****...a3f2', status: 'Active', created: 'Jan 5, 2026', lastUsed: '2 min ago', requests: 45230 },
  { id: '2', name: 'Staging Environment', key: 'sk-stg-****...b7c1', status: 'Active', created: 'Feb 12, 2026', lastUsed: '1 hr ago', requests: 8741 },
  { id: '3', name: 'CI/CD Pipeline', key: 'sk-ci-****...d9e4', status: 'Active', created: 'Dec 20, 2025', lastUsed: '15 min ago', requests: 12390 },
  { id: '4', name: 'Legacy Integration', key: 'sk-leg-****...f1a8', status: 'Expired', created: 'Sep 3, 2025', lastUsed: 'Nov 15, 2025', requests: 0 },
  { id: '5', name: 'Partner API Access', key: 'sk-prt-****...c5d2', status: 'Revoked', created: 'Oct 18, 2025', lastUsed: 'Dec 1, 2025', requests: 0 },
  { id: '6', name: 'Mobile SDK', key: 'pk-mob-****...e8f3', status: 'Active', created: 'Feb 28, 2026', lastUsed: '5 min ago', requests: 31204 },
]

function getStatusBadge(status: string) {
  switch (status) {
    case 'Active':
      return <Badge variant="success">Active</Badge>
    case 'Revoked':
      return <Badge variant="destructive">Revoked</Badge>
    case 'Expired':
      return <Badge variant="secondary">Expired</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export default function ApiKeysPage() {
  const { setBreadcrumbs } = useUIStore()

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'API Keys', active: true },
    ])
  }, [setBreadcrumbs])

  const activeKeys = apiKeys.filter((k) => k.status === 'Active').length
  const expiredKeys = apiKeys.filter((k) => k.status === 'Expired').length
  const totalRequests = apiKeys.reduce((sum, k) => sum + k.requests, 0)

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <Breadcrumb />
          <div className="mt-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
              <p className="text-muted-foreground">
                Generate and manage API keys for programmatic access
              </p>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Generate New Key
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Keys</CardTitle>
              <Key className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{apiKeys.length}</div>
              <p className="text-xs text-muted-foreground">All time generated</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Keys</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeKeys}</div>
              <p className="text-xs text-muted-foreground">Currently in use</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expired Keys</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{expiredKeys}</div>
              <p className="text-xs text-muted-foreground">Need rotation</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Requests Today</CardTitle>
              <Key className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRequests.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Across all active keys</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>API Key Registry</CardTitle>
            <CardDescription>All generated API keys and their current status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Key</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Created</th>
                    <th className="pb-3 font-medium">Last Used</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((apiKey) => (
                    <tr key={apiKey.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">{apiKey.name}</td>
                      <td className="py-3 font-mono text-xs text-muted-foreground">
                        {apiKey.key}
                      </td>
                      <td className="py-3">{getStatusBadge(apiKey.status)}</td>
                      <td className="py-3 text-muted-foreground">{apiKey.created}</td>
                      <td className="py-3 text-muted-foreground">{apiKey.lastUsed}</td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" aria-label="Copy API key">
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" aria-label="Delete API key">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
