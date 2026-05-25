'use client'

import { useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  FileText,
  Shield,
  AlertTriangle,
  Search,
  Filter,
  Clock,
} from 'lucide-react'

const auditEntries = [
  { ts: '2026-03-07 14:32:11', user: 'john.doe@acme.com', action: 'LOGIN_SUCCESS', resource: 'Auth Service', ip: '192.168.1.42', status: 'success' },
  { ts: '2026-03-07 14:28:05', user: 'admin@globex.com', action: 'POLICY_UPDATE', resource: 'Rate Limit Policy', ip: '10.0.0.15', status: 'success' },
  { ts: '2026-03-07 14:15:33', user: 'unknown', action: 'LOGIN_FAILED', resource: 'Auth Service', ip: '203.0.113.99', status: 'failure' },
  { ts: '2026-03-07 13:58:47', user: 'sarah.m@initech.io', action: 'DATA_EXPORT', resource: 'Reports API', ip: '172.16.0.8', status: 'success' },
  { ts: '2026-03-07 13:42:19', user: 'unknown', action: 'LOGIN_FAILED', resource: 'Auth Service', ip: '203.0.113.99', status: 'failure' },
  { ts: '2026-03-07 13:30:02', user: 'mike.j@acme.com', action: 'ROLE_CHANGE', resource: 'User: lisa.w', ip: '192.168.1.55', status: 'success' },
  { ts: '2026-03-07 12:54:16', user: 'admin@globex.com', action: 'TENANT_CONFIG', resource: 'Globex Settings', ip: '10.0.0.15', status: 'success' },
  { ts: '2026-03-07 12:11:08', user: 'bot@scanner', action: 'POLICY_VIOLATION', resource: 'DLP Scanner', ip: '198.51.100.22', status: 'blocked' },
]

const eventTypes = ['All Events', 'Login', 'Policy', 'Data Access', 'Admin', 'Security']

function statusBadge(status: string) {
  if (status === 'success') return <Badge variant="success">Success</Badge>
  if (status === 'failure') return <Badge variant="destructive">Failed</Badge>
  return <Badge variant="warning">Blocked</Badge>
}

export default function AuditLogsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('All Events')

  const filtered = auditEntries.filter((entry) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchesSearch = entry.user.toLowerCase().includes(q)
        || entry.action.toLowerCase().includes(q)
        || entry.resource.toLowerCase().includes(q)
      if (!matchesSearch) return false
    }
    return true
  })

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">
            Security events, user actions, and compliance audit trail.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">24,891</div>
              <p className="text-xs text-muted-foreground">Last 24 hours</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Security Events</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">342</div>
              <p className="text-xs text-muted-foreground">+12% from yesterday</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">47</div>
              <p className="text-xs text-muted-foreground">3 suspicious IPs flagged</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Policy Violations</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8</div>
              <p className="text-xs text-muted-foreground">All auto-blocked</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Event Log</CardTitle>
            <CardDescription>Filtered view of platform audit events</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by user, action, or resource..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-1 rounded-lg border p-1">
                {eventTypes.slice(0, 4).map((type) => (
                  <Button
                    key={type}
                    size="sm"
                    variant={selectedType === type ? 'default' : 'ghost'}
                    onClick={() => setSelectedType(type)}
                  >
                    {type}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" aria-label="Filter events">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-4 py-2 font-medium">Timestamp</th>
                    <th className="px-4 py-2 font-medium">User</th>
                    <th className="px-4 py-2 font-medium">Action</th>
                    <th className="px-4 py-2 font-medium">Resource</th>
                    <th className="px-4 py-2 font-medium">IP Address</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{entry.ts}</td>
                      <td className="px-4 py-2">{entry.user}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline">{entry.action}</Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{entry.resource}</td>
                      <td className="px-4 py-2 font-mono text-xs">{entry.ip}</td>
                      <td className="px-4 py-2">{statusBadge(entry.status)}</td>
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
