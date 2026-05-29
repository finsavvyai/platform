'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { Breadcrumb } from '@/components/navigation/breadcrumb'
import { DataTable } from '@/components/ui/data-table'
import { UserFilters } from '@/components/users/user-filters'
import { UserOverview } from '@/components/users/user-overview'
import { UserBulkActions } from '@/components/users/user-bulk-actions'
import { UserOnboardingWizard } from '@/components/users/user-onboarding-wizard'
import { useUserPage } from './use-user-page'

export default function UsersPage() {
  const {
    users,
    userStats,
    userRoles,
    tenants,
    selectedUserIds,
    userFilters,
    columns,
    isLoadingUsers,
    isLoadingStats,
    isLoadingRoles,
    isLoadingTenants,
    isBulkActionsOpen,
    setIsBulkActionsOpen,
    isOnboardingOpen,
    setIsOnboardingOpen,
    processingAction,
    creatingUser,
    handleRowClick,
    handleSelectionChange,
    handleFiltersChange,
    handleBulkAction,
    handleCreateUser,
    fetchUsers,
  } = useUserPage()

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
