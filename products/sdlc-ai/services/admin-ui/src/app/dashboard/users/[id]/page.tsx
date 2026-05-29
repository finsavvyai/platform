'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { shallow } from 'zustand/shallow'
import { AppLayout } from '@/components/layout/app-layout'
import { Breadcrumb } from '@/components/navigation/breadcrumb'
import { useUserManagementStore } from '@/store'
import { useUIStore } from '@/store/ui'
import { useToast } from '@/components/ui/use-toast'
import { UserProfileCard } from '@/components/users/user-profile-card'
import { UserActivityTimeline } from '@/components/users/user-activity-timeline'
import { UserAccessCard } from '@/components/users/user-access-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarDays, MapPin, Building2 } from 'lucide-react'
import { format } from 'date-fns'

export default function UserDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const setBreadcrumbs = useUIStore((state) => state.setBreadcrumbs)

  const [
    currentUser,
    userActivity,
    tenantUsage,
    loading,
    fetchUser,
    fetchUserActivity,
    fetchTenantUsage,
    clearCurrentUser,
  ] = useUserManagementStore(
    (state) => [
      state.currentUser,
      state.userActivity,
      state.tenantUsage,
      state.loading,
      state.fetchUser,
      state.fetchUserActivity,
      state.fetchTenantUsage,
      state.clearCurrentUser,
    ],
    shallow
  )

  useEffect(() => {
    const userId = params?.id
    if (!userId) return

    setBreadcrumbs([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'User management', href: '/dashboard/users' },
      { label: 'User detail', active: true },
    ])

    fetchUser(userId).then((user) => {
      if (!user) {
        toast({
          title: 'User not found',
          description: 'The requested user could not be located.',
          variant: 'destructive',
        })
        router.replace('/dashboard/users')
        return
      }
      fetchUserActivity(userId).catch(() => undefined)
      if (user.tenantId) {
        fetchTenantUsage(user.tenantId).catch(() => undefined)
      }
    })

    return () => {
      clearCurrentUser()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.id])

  const isLoadingUser = Boolean(loading.fetchUser)
  const isLoadingActivity = Boolean(loading.fetchUserActivity)

  return (
    <AppLayout>
      <div className="space-y-6">
        <Breadcrumb />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <UserProfileCard user={currentUser} loading={isLoadingUser} />
            <UserActivityTimeline activities={userActivity} loading={isLoadingActivity} />
          </div>

          <div className="space-y-6">
            <UserAccessCard user={currentUser} />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Tenant usage
                </CardTitle>
                <CardDescription>
                  Consumption metrics for the tenant this user belongs to.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {tenantUsage ? (
                  <>
                    <div className="grid gap-2 rounded-md border border-border p-3">
                      <span className="text-xs uppercase text-muted-foreground">Users</span>
                      <span className="font-medium">
                        {tenantUsage.usage.users} / {tenantUsage.limits.users}
                      </span>
                    </div>
                    <div className="grid gap-2 rounded-md border border-border p-3">
                      <span className="text-xs uppercase text-muted-foreground">Storage</span>
                      <span className="font-medium">
                        {tenantUsage.usage.storage} GB / {tenantUsage.limits.storage} GB
                      </span>
                    </div>
                    <div className="grid gap-2 rounded-md border border-border p-3">
                      <span className="text-xs uppercase text-muted-foreground">API calls</span>
                      <span className="font-medium">
                        {tenantUsage.usage.apiCalls} / {tenantUsage.limits.apiCalls}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    Tenant usage metrics will appear once data is available.
                  </p>
                )}
              </CardContent>
            </Card>

            {currentUser && (
              <Card>
                <CardHeader>
                  <CardTitle>Profile metadata</CardTitle>
                  <CardDescription>Additional context about this account.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    <span>
                      Joined{' '}
                      {currentUser.createdAt
                        ? format(
                            typeof currentUser.createdAt === 'string'
                              ? new Date(currentUser.createdAt)
                              : currentUser.createdAt,
                            'PP'
                          )
                        : '—'}
                    </span>
                  </div>
                  {currentUser.location && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{currentUser.location}</span>
                    </div>
                  )}
                  {currentUser.department && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="font-medium">Department:</span>
                      <span>{currentUser.department}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
