'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { shallow } from 'zustand/shallow'
import { AppLayout } from '@/components/layout/app-layout'
import { Breadcrumb } from '@/components/navigation/breadcrumb'
import { useUserManagementStore } from '@/store'
import { useUIStore } from '@/store/ui'
import { useToast } from '@/components/ui/use-toast'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  Mail,
  Users,
  GaugeCircle,
  HardDrive,
  Shield,
  Clock,
} from 'lucide-react'
import { format } from 'date-fns'

export default function TenantDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const setBreadcrumbs = useUIStore((state) => state.setBreadcrumbs)

  const [
    currentTenant,
    tenantUsage,
    loading,
    fetchTenant,
    fetchTenantUsage,
    clearCurrentTenant,
  ] = useUserManagementStore(
    (state) => [
      state.currentTenant,
      state.tenantUsage,
      state.loading,
      state.fetchTenant,
      state.fetchTenantUsage,
      state.clearCurrentTenant,
    ],
    shallow
  )

  useEffect(() => {
    const tenantId = params?.id
    if (!tenantId) return

    setBreadcrumbs([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Tenants', href: '/dashboard/tenants' },
      { label: 'Tenant detail', active: true },
    ])

    fetchTenant(tenantId).then((tenant) => {
      if (!tenant) {
        toast({
          title: 'Tenant not found',
          description: 'The requested tenant could not be located.',
          variant: 'destructive',
        })
        router.replace('/dashboard/tenants')
        return
      }
      fetchTenantUsage(tenantId).catch(() => undefined)
    })

    return () => {
      clearCurrentTenant()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.id])

  const isLoadingTenant = Boolean(loading.fetchTenant)
  const statusVariant: Record<string, React.ComponentProps<typeof Badge>['variant']> = {
    ACTIVE: 'success',
    INACTIVE: 'secondary',
    SUSPENDED: 'destructive',
    TRIAL: 'warning',
    PENDING_CANCELLATION: 'warning',
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <Breadcrumb />

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-2xl font-semibold">
                  {currentTenant?.displayName || currentTenant?.name || 'Loading tenant…'}
                </CardTitle>
                <CardDescription>{currentTenant?.domain}</CardDescription>
              </div>
              {currentTenant && (
                <Badge variant={statusVariant[currentTenant.status] ?? 'secondary'}>
                  {currentTenant.status.toLowerCase()}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2 rounded-md border border-border p-4">
                <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  Plan
                </span>
                <span className="text-sm font-medium">
                  {currentTenant?.plan.displayName || currentTenant?.plan.name || '—'}
                </span>
              </div>
              <div className="flex flex-col gap-2 rounded-md border border-border p-4">
                <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  Billing contact
                </span>
                <span className="text-sm font-medium">
                  {currentTenant?.billing?.billingEmail || 'Not configured'}
                </span>
              </div>
              <div className="flex flex-col gap-2 rounded-md border border-border p-4">
                <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Created
                </span>
                <span className="text-sm font-medium">
                  {currentTenant?.createdAt
                    ? format(
                        typeof currentTenant.createdAt === 'string'
                          ? new Date(currentTenant.createdAt)
                          : currentTenant.createdAt,
                        'PP'
                      )
                    : '—'}
                </span>
              </div>
              <div className="flex flex-col gap-2 rounded-md border border-border p-4">
                <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" />
                  Security level
                </span>
                <span className="text-sm font-medium">
                  {currentTenant?.settings?.enforceMFA ? 'MFA enforced' : 'Baseline'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GaugeCircle className="h-5 w-5 text-primary" />
                Usage snapshot
              </CardTitle>
              <CardDescription>Real-time consumption within plan limits.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {tenantUsage ? (
                <>
                  <div className="rounded-md border border-border p-3">
                    <span className="text-xs uppercase text-muted-foreground">Users</span>
                    <div className="mt-1 font-semibold">
                      {tenantUsage.usage.users} / {tenantUsage.limits.users}
                    </div>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <span className="text-xs uppercase text-muted-foreground">Storage</span>
                    <div className="mt-1 font-semibold">
                      {tenantUsage.usage.storage} GB / {tenantUsage.limits.storage} GB
                    </div>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <span className="text-xs uppercase text-muted-foreground">API calls</span>
                    <div className="mt-1 font-semibold">
                      {tenantUsage.usage.apiCalls} / {tenantUsage.limits.apiCalls}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">
                  Usage metrics are loading or unavailable for this tenant.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
