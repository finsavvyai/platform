'use client'

import { useEffect } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { Breadcrumb } from '@/components/navigation/breadcrumb'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useUIStore } from '@/store/ui'
import { Shield, Users, Lock, Plus, Edit, Trash2 } from 'lucide-react'

const roles = [
  {
    id: '1',
    name: 'Super Admin',
    description: 'Full system access with all permissions across all tenants',
    userCount: 3,
    permissions: ['Full Access', 'Tenant Management', 'Billing', 'Security'],
  },
  {
    id: '2',
    name: 'Admin',
    description: 'Organization-level management with elevated privileges',
    userCount: 12,
    permissions: ['User Management', 'Settings', 'Analytics', 'API Keys'],
  },
  {
    id: '3',
    name: 'Developer',
    description: 'Access to development tools, APIs, and pipeline management',
    userCount: 87,
    permissions: ['API Access', 'Pipelines', 'Logs', 'Deployments'],
  },
  {
    id: '4',
    name: 'Viewer',
    description: 'Read-only access to dashboards and reports',
    userCount: 214,
    permissions: ['View Dashboards', 'View Reports', 'View Logs'],
  },
  {
    id: '5',
    name: 'Auditor',
    description: 'Compliance and audit log access for regulatory reviews',
    userCount: 8,
    permissions: ['Audit Logs', 'Compliance Reports', 'Policy Review'],
  },
]

export default function RolesPage() {
  const { setBreadcrumbs } = useUIStore()

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Roles & Permissions', active: true },
    ])
  }, [setBreadcrumbs])

  const totalUsers = roles.reduce((sum, r) => sum + r.userCount, 0)
  const customRoles = roles.length - 2
  const permissionGroups = new Set(roles.flatMap((r) => r.permissions)).size

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <Breadcrumb />
          <div className="mt-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Roles & Permissions</h1>
              <p className="text-muted-foreground">
                Manage access roles and permission groups across your organization
              </p>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{roles.length}</div>
              <p className="text-xs text-muted-foreground">Across all tenants</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Custom Roles</CardTitle>
              <Lock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customRoles}</div>
              <p className="text-xs text-muted-foreground">User-defined roles</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Users Assigned</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
              <p className="text-xs text-muted-foreground">With active role assignments</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Permission Groups</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{permissionGroups}</div>
              <p className="text-xs text-muted-foreground">Unique permissions defined</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {roles.map((role) => (
            <Card key={role.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {role.name}
                    </CardTitle>
                    <CardDescription>{role.description}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" aria-label="Edit role">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label="Delete role">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {role.userCount} users assigned
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {role.permissions.map((perm) => (
                    <Badge key={perm} variant="secondary">{perm}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
