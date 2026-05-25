'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { shallow } from 'zustand/shallow'
import { AppLayout } from '@/components/layout/app-layout'
import { Breadcrumb } from '@/components/navigation/breadcrumb'
import { useUserManagementStore } from '@/store'
import { useUIStore } from '@/store/ui'
import { useToast } from '@/components/ui/use-toast'
import { tenantColumns } from '@/components/tenants/columns'
import { TenantFilters } from '@/components/tenants/tenant-filters'
import { DataTable } from '@/components/ui/data-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Building2, Users, GaugeCircle, TrendingUp } from 'lucide-react'
import type { CreateTenantRequest, Tenant } from '@/types/user-management'
import { TenantCreateForm } from '@/components/tenants/tenant-create-form'

export default function TenantsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const setBreadcrumbs = useUIStore((state) => state.setBreadcrumbs)

  const [
    tenants,
    tenantFilters,
    loadingMap,
    fetchTenants,
    createTenant,
    setTenantFilters,
  ] = useUserManagementStore(
    (state) => [
      state.tenants,
      state.tenantFilters,
      state.loading,
      state.fetchTenants,
      state.createTenant,
      state.setTenantFilters,
    ],
    shallow
  )

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [creatingTenant, setCreatingTenant] = useState(false)

  const columns = useMemo(() => tenantColumns, [])

  const isLoadingTenants = Boolean(loadingMap.fetchTenants)

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Tenants', active: true },
    ])

    fetchTenants().catch((error) => {
      toast({
        title: 'Failed to load tenants',
        description: error instanceof Error ? error.message : 'Unexpected error occurred',
        variant: 'destructive',
      })
    })
  }, [fetchTenants, setBreadcrumbs, toast])

  const handleFiltersChange = (filters: Record<string, any>) => {
    setTenantFilters(filters)
    fetchTenants(filters).catch((error) => {
      toast({
        title: 'Failed to apply filters',
        description: error instanceof Error ? error.message : 'Unexpected error applying tenant filters',
        variant: 'destructive',
      })
    })
  }

  const handleCreateTenant = async (payload: CreateTenantRequest) => {
    try {
      setCreatingTenant(true)
      const tenant = await createTenant(payload)
      toast({
        title: 'Tenant created',
        description: `${tenant.displayName || tenant.name} is ready for onboarding.`,
      })
      setIsCreateOpen(false)
      await fetchTenants()
    } catch (error) {
      toast({
        title: 'Failed to create tenant',
        description: error instanceof Error ? error.message : 'Unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setCreatingTenant(false)
    }
  }

  const totalTenants = tenants.length
  const activeTenants = tenants.filter((tenant) => tenant.status === 'ACTIVE').length
  const trialTenants = tenants.filter((tenant) => tenant.status === 'TRIAL').length

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <Breadcrumb />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tenant management</h1>
            <p className="text-muted-foreground">
              Oversee environments, enforce policies, and monitor adoption across organizations.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Total tenants</CardDescription>
              <Building2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTenants}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Active tenants</CardDescription>
              <Users className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeTenants}</div>
              <p className="text-xs text-muted-foreground">
                {totalTenants > 0 ? Math.round((activeTenants / totalTenants) * 100) : 0}% active
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Trial tenants</CardDescription>
              <GaugeCircle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{trialTenants}</div>
              <p className="text-xs text-muted-foreground">Focus on conversion</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Growth</CardDescription>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalTenants > 0 ? Math.round((activeTenants / totalTenants) * 100) : 0}%
              </div>
              <p className="text-xs text-muted-foreground">Active utilization rate</p>
            </CardContent>
          </Card>
        </div>

        <TenantFilters
          filters={tenantFilters}
          onChange={handleFiltersChange}
          onCreateTenant={() => setIsCreateOpen(true)}
          onRefresh={() => fetchTenants().catch(() => undefined)}
        />

        <div className="rounded-lg border bg-card">
          <DataTable
            title="Tenants"
            description="Manage customer environments and monitor their usage."
            columns={columns}
            data={tenants}
            loading={isLoadingTenants}
            onRowClick={(tenant: Tenant) => router.push(`/dashboard/tenants/${tenant.id}`)}
            selectable={false}
          />
        </div>

        <TenantCreateForm
          open={isCreateOpen}
          loading={creatingTenant}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={handleCreateTenant}
        />
      </div>
    </AppLayout>
  )
}
