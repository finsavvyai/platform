'use client'

import { useEffect, useState } from 'react'
import {
  Download,
  Plus,
  RefreshCw,
  Upload,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useUserManagementStore } from '@/store/user-management'
import { useDebounce } from '@/hooks/use-debounce'
import { useToast } from '@/hooks/use-toast'
import type { UserStatus } from '@/types/user-management'
import { UserFiltersPanel } from './_components/user-filters-panel'
import { UserTable } from './_components/user-table'
import { UserPagination } from './_components/user-pagination'
import { BulkActionsBar } from './_components/bulk-actions-bar'
import { BulkConfirmDialog, BulkInviteDialog } from './_components/bulk-action-dialogs'

export default function UsersPage() {
  const {
    users, totalUsers, userPagination, userFilters,
    selectedUserIds, loading, errors, userRoles,
    fetchUsers, runBulkOperation, fetchUserRoles,
    setFilter, setPagination, setSelectedUserIds,
  } = useUserManagementStore()

  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<UserStatus[]>([])
  const [roleFilter, setRoleFilter] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const [bulkAction, setBulkAction] = useState<string>('')
  const [showBulkInvite, setShowBulkInvite] = useState(false)
  const [inviteEmails, setInviteEmails] = useState('')

  const debouncedSearch = useDebounce(searchQuery, 300)

  useEffect(() => { fetchUserRoles() }, [fetchUserRoles])
  useEffect(() => { fetchUsers() }, [debouncedSearch, statusFilter, roleFilter, userPagination, fetchUsers])

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    setPagination({ offset: 0 })
  }

  const handleStatusFilterChange = (status: UserStatus, checked: boolean) => {
    const updated = checked ? [...statusFilter, status] : statusFilter.filter((s) => s !== status)
    setStatusFilter(updated)
    setFilter({ status: updated })
    setPagination({ offset: 0 })
  }

  const handleRoleFilterChange = (roleId: string, checked: boolean) => {
    const updated = checked ? [...roleFilter, roleId] : roleFilter.filter((r) => r !== roleId)
    setRoleFilter(updated)
    setFilter({ role: updated })
    setPagination({ offset: 0 })
  }

  const handleBulkAction = async (action: string) => {
    if (selectedUserIds.length === 0) {
      toast({ title: 'No users selected', description: 'Please select at least one user.', variant: 'destructive' })
      return
    }
    setBulkAction(action)
    setShowBulkConfirm(true)
  }

  const executeBulkAction = async () => {
    try {
      await runBulkOperation({ action: bulkAction as any, userIds: selectedUserIds })
      toast({ title: 'Success', description: `Bulk ${bulkAction} completed successfully.` })
      setSelectedUserIds([])
      setShowBulkConfirm(false)
      fetchUsers()
    } catch (error) {
      toast({ title: 'Error', description: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: 'destructive' })
    }
  }

  const handleBulkInvite = async () => {
    const emails = inviteEmails.split('\n').map((e) => e.trim()).filter((e) => e && e.includes('@'))
    if (emails.length === 0) {
      toast({ title: 'Invalid emails', description: 'Please enter valid email addresses.', variant: 'destructive' })
      return
    }
    try {
      await runBulkOperation({ action: 'invite', userIds: emails, params: { emails } })
      toast({ title: 'Invitations sent', description: `${emails.length} invitation(s) sent successfully.` })
      setShowBulkInvite(false)
      setInviteEmails('')
    } catch (error) {
      toast({ title: 'Error', description: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: 'destructive' })
    }
  }

  const handleExportUsers = () => {
    const csvContent = [
      'ID,Email,Name,Role,Status,Tenant,Last Login,Created At',
      ...users.map((u) => [u.id, u.email, u.name, u.role.displayName, u.status, u.tenantName || '', u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : '', u.createdAt].join(',')),
    ].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `users-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(totalUsers / userPagination.limit)
  const currentPage = Math.floor(userPagination.offset / userPagination.limit) + 1

  if (errors.fetchUsers) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Error Loading Users</CardTitle>
          <CardDescription>{errors.fetchUsers}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button onClick={() => fetchUsers()} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">Manage user accounts and permissions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowBulkInvite(true)}>
            <Upload className="mr-2 h-4 w-4" /> Bulk Invite
          </Button>
          <Button variant="outline" onClick={handleExportUsers}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button onClick={() => window.location.href = '/users/create'}>
            <Plus className="mr-2 h-4 w-4" /> Add User
          </Button>
        </div>
      </div>

      <Card>
        <UserFiltersPanel
          searchQuery={searchQuery} onSearch={handleSearch}
          statusFilter={statusFilter} onStatusFilterChange={handleStatusFilterChange}
          roleFilter={roleFilter} onRoleFilterChange={handleRoleFilterChange}
          showFilters={showFilters} onToggleFilters={() => setShowFilters(!showFilters)}
          userRoles={userRoles} isLoading={loading.fetchUsers ?? false} onRefresh={() => fetchUsers()}
        />
        <BulkActionsBar
          selectedCount={selectedUserIds.length}
          onClearSelection={() => setSelectedUserIds([])}
          onBulkAction={handleBulkAction}
        />
        <CardContent>
          {loading.fetchUsers ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-lg font-semibold">No users found</h3>
              <p className="text-muted-foreground">
                {searchQuery || statusFilter.length > 0 || roleFilter.length > 0
                  ? 'Try adjusting your filters' : 'Get started by adding your first user'}
              </p>
              {!searchQuery && statusFilter.length === 0 && roleFilter.length === 0 && (
                <Button className="mt-4" onClick={() => window.location.href = '/users/create'}>
                  <Plus className="mr-2 h-4 w-4" /> Add User
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <UserTable
                users={users} selectedUserIds={selectedUserIds}
                onSelectAll={(checked) => setSelectedUserIds(checked ? users.map((u) => u.id) : [])}
                onSelectUser={(id, checked) => setSelectedUserIds(checked ? [...selectedUserIds, id] : selectedUserIds.filter((x) => x !== id))}
                onBulkAction={handleBulkAction}
              />
              <UserPagination
                totalUsers={totalUsers} currentPage={currentPage} totalPages={totalPages}
                offset={userPagination.offset} limit={userPagination.limit}
                onPageChange={(o) => setPagination({ offset: o })}
                onLimitChange={(l) => setPagination({ limit: l, offset: 0 })}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <BulkConfirmDialog
        open={showBulkConfirm} onOpenChange={setShowBulkConfirm}
        bulkAction={bulkAction} selectedCount={selectedUserIds.length}
        isLoading={loading.bulkUsers ?? false} onConfirm={executeBulkAction}
      />
      <BulkInviteDialog
        open={showBulkInvite} onOpenChange={setShowBulkInvite}
        inviteEmails={inviteEmails} onEmailsChange={setInviteEmails} onSend={handleBulkInvite}
      />
    </div>
  )
}
