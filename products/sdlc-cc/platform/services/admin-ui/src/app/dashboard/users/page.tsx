'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { shallow } from 'zustand/shallow'
import { AppLayout } from '@/components/layout/app-layout'
import { Breadcrumb } from '@/components/navigation/breadcrumb'
import { DataTable } from '@/components/ui/data-table'
import { userColumns } from '@/components/users/columns'
import { UserFilters } from '@/components/users/user-filters'
import { UserOverview } from '@/components/users/user-overview'
import { UserBulkActions } from '@/components/users/user-bulk-actions'
import { UserOnboardingWizard } from '@/components/users/user-onboarding-wizard'
import { useUserManagementStore } from '@/store'
import { useUIStore } from '@/store/ui'
import { useToast } from '@/components/ui/use-toast'
import type { User as ManagedUser, BulkUserOperation } from '@/types/user-management'

export default function UsersPage() {
  const router = useRouter()
  const { toast } = useToast()
  const setBreadcrumbs = useUIStore((state) => state.setBreadcrumbs)

  const [
    users,
    userStats,
    userRoles,
    tenants,
    selectedUserIds,
    userFilters,
    loadingMap,
    fetchUsers,
    fetchUserStats,
    fetchUserRoles,
    fetchTenants,
    runBulkOperation,
    createUser,
    setFilter,
    setSelectedUserIds,
  ] = useUserManagementStore(
    (state) => [
      state.users,
      state.userStats,
      state.userRoles,
      state.tenants,
      state.selectedUserIds,
      state.userFilters,
      state.loading,
      state.fetchUsers,
      state.fetchUserStats,
      state.fetchUserRoles,
      state.fetchTenants,
      state.runBulkOperation,
      state.createUser,
      state.setFilter,
      state.setSelectedUserIds,
    ],
    shallow
  )

  const [isBulkActionsOpen, setIsBulkActionsOpen] = useState(false)
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
  const [processingAction, setProcessingAction] = useState<string | null>(null)
  const [creatingUser, setCreatingUser] = useState(false)

  const isLoadingUsers = Boolean(loadingMap.fetchUsers)
  const isLoadingStats = Boolean(loadingMap.fetchUserStats)
  const isLoadingRoles = Boolean(loadingMap.fetchRoles)
  const isLoadingTenants = Boolean(loadingMap.fetchTenants)

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'User management', active: true },
    ])
  }, [setBreadcrumbs])

  useEffect(() => {
    fetchUsers().catch((error) => {
      toast({
        title: 'Failed to load users',
        description: error instanceof Error ? error.message : 'Unexpected error loading users',
        variant: 'destructive',
      })
    })
    fetchUserStats().catch(() => {
      /* handled by toast elsewhere */
    })
    fetchUserRoles().catch(() => {
      /* optional */
    })
    fetchTenants().catch(() => {
      /* optional */
    })
  }, [fetchUsers, fetchUserStats, fetchUserRoles, fetchTenants, toast])

  const columns = useMemo(() => userColumns, [])

  const handleRowClick = (user: ManagedUser) => {
    router.push(`/dashboard/users/${user.id}`)
  }

  const handleSelectionChange = (rows: ManagedUser[]) => {
    setSelectedUserIds(rows.map((row) => row.id))
  }

  const handleFiltersChange = (filters: Partial<typeof userFilters>) => {
    setFilter(filters)
    fetchUsers(filters).catch((error) => {
      toast({
        title: 'Failed to apply filters',
        description: error instanceof Error ? error.message : 'Unexpected error while filtering',
        variant: 'destructive',
      })
    })
  }

  const handleBulkAction = async (operation: BulkUserOperation) => {
    try {
      setProcessingAction(operation.action)
      await runBulkOperation({ ...operation, userIds: selectedUserIds })
      await fetchUsers()
      toast({
        title: 'Bulk action scheduled',
        description: 'The requested operation is now processing.',
      })
      setSelectedUserIds([])
    } catch (error) {
      toast({
        title: 'Failed to run bulk action',
        description: error instanceof Error ? error.message : 'Unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setProcessingAction(null)
    }
  }

  const handleCreateUser = async (payload: Parameters<typeof createUser>[0]) => {
    try {
      setCreatingUser(true)
      await createUser(payload)
      await fetchUsers()
      toast({
        title: 'User created',
        description: `${payload.name} has been added successfully.`,
      })
    } catch (error) {
      toast({
        title: 'Failed to create user',
        description: error instanceof Error ? error.message : 'Unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setCreatingUser(false)
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <Breadcrumb />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User management</h1>
            <p className="text-muted-foreground">
              Manage users, track activity, and orchestrate onboarding workflows across tenants.
            </p>
          </div>
        </div>

        <UserOverview stats={userStats} loading={isLoadingStats} />

        <UserFilters
          filters={userFilters}
          roles={userRoles}
          tenants={tenants}
          selectedCount={selectedUserIds.length}
          onChange={handleFiltersChange}
          onInvite={() => setIsOnboardingOpen(true)}
          onBulkAction={() => setIsBulkActionsOpen((prev) => !prev)}
          onRefresh={() => fetchUsers().catch(() => undefined)}
        />

        {isBulkActionsOpen && (
          <UserBulkActions
            open={isBulkActionsOpen}
            onClose={() => setIsBulkActionsOpen(false)}
            selectedCount={selectedUserIds.length}
            userIds={selectedUserIds}
            roles={userRoles}
            processingAction={processingAction}
            onSubmit={handleBulkAction}
          />
        )}

        <div className="rounded-lg border bg-card">
          <DataTable
            title="Users"
            description="Search, filter, and manage platform users."
            columns={columns}
            data={users}
            loading={isLoadingUsers || isLoadingRoles || isLoadingTenants}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
          />
        </div>

        <UserOnboardingWizard
          open={isOnboardingOpen}
          tenants={tenants}
          roles={userRoles}
          loading={creatingUser}
          onSubmit={handleCreateUser}
          onClose={() => setIsOnboardingOpen(false)}
        />
      </div>
    </AppLayout>
  )
}
