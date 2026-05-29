'use client'

import { useEffect } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { Breadcrumb } from '@/components/navigation/breadcrumb'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useUIStore } from '@/store/ui'
import { Lock, Shield, FileText, Plus, CheckCircle, AlertCircle, Clock } from 'lucide-react'

const policies = [
  {
    id: '1',
    name: 'Data Access Policy',
    description: 'Controls data access based on user classification and clearance level',
    status: 'Active',
    lastUpdated: 'Mar 5, 2026',
    enforcement: 'Strict',
  },
  {
    id: '2',
    name: 'Rate Limiting Policy',
    description: 'Enforces request rate limits per tenant and API endpoint',
    status: 'Active',
    lastUpdated: 'Mar 3, 2026',
    enforcement: 'Standard',
  },
  {
    id: '3',
    name: 'DLP Policy',
    description: 'Prevents sensitive data exposure in API responses and logs',
    status: 'Draft',
    lastUpdated: 'Feb 28, 2026',
    enforcement: 'Permissive',
  },
  {
    id: '4',
    name: 'Authentication Policy',
    description: 'Mandates MFA for admin access and enforces session timeouts',
    status: 'Active',
    lastUpdated: 'Mar 1, 2026',
    enforcement: 'Strict',
  },
  {
    id: '5',
    name: 'Network Policy',
    description: 'Restricts ingress and egress traffic to approved IP ranges',
    status: 'Disabled',
    lastUpdated: 'Jan 15, 2026',
    enforcement: 'Standard',
  },
]

function getStatusBadge(status: string) {
  switch (status) {
    case 'Active':
      return <Badge variant="default">Active</Badge>
    case 'Draft':
      return <Badge variant="secondary">Draft</Badge>
    case 'Disabled':
      return <Badge variant="outline">Disabled</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'Active':
      return <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
    case 'Draft':
      return <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
    case 'Disabled':
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />
    default:
      return null
  }
}

export default function PoliciesPage() {
  const { setBreadcrumbs } = useUIStore()

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Security Policies', active: true },
    ])
  }, [setBreadcrumbs])

  const activePolicies = policies.filter((p) => p.status === 'Active').length
  const violations24h = 17
  const complianceScore = 94
  const pendingReviews = policies.filter((p) => p.status === 'Draft').length

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <Breadcrumb />
          <div className="mt-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Security Policies</h1>
              <p className="text-muted-foreground">
                Define and enforce security policies across your platform
              </p>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Policy
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Policies</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activePolicies}</div>
              <p className="text-xs text-muted-foreground">Currently enforced</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Violations (24h)</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{violations24h}</div>
              <p className="text-xs text-muted-foreground">-23% from yesterday</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{complianceScore}%</div>
              <p className="text-xs text-muted-foreground">SOC 2 + HIPAA + GDPR</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingReviews}</div>
              <p className="text-xs text-muted-foreground">Awaiting approval</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {policies.map((policy) => (
            <Card key={policy.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(policy.status)}
                    <CardTitle>{policy.name}</CardTitle>
                  </div>
                  {getStatusBadge(policy.status)}
                </div>
                <CardDescription>{policy.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {policy.lastUpdated}
                    </span>
                    <span className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      {policy.enforcement}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm">
                    <FileText className="h-4 w-4 mr-1" />
                    Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
