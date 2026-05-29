'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Filter,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useUserManagementStore } from '@/store/user-management'
import { useDebounce } from '@/hooks/use-debounce'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { User, UserStatus, UserRole } from '@/types/user-management'

const STATUS_CONFIG = {
  ACTIVE: { label: 'Active', color: 'success' as const },
  INACTIVE: { label: 'Inactive', color: 'secondary' as const },
  SUSPENDED: { label: 'Suspended', color: 'destructive' as const },
  PENDING: { label: 'Pending', color: 'warning' as const },
  LOCKED: { label: 'Locked', color: 'destructive' as const },
}

const PAGINATION_LIMITS = [10, 20, 50, 100]

export default function UsersPage() {
  const {
    users,
    totalUsers,
    userPagination,
    userFilters,
    selectedUserIds,
    loading,
    errors,
    userRoles,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    runBulkOperation,
    fetchUserRoles,
    setFilter,
    setPagination,
    setSelectedUserIds,
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

  useEffect(() => {
    fetchUserRoles()
  }, [fetchUserRoles])

  useEffect(() => {
    fetchUsers()
  }, [debouncedSearch, statusFilter, roleFilter, userPagination, fetchUsers])

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    setPagination({ offset: 0 })
  }

  const handleStatusFilterChange = (status: UserStatus, checked: boolean) => {
    const updated = checked
      ? [...statusFilter, status]
      : statusFilter.filter((s) => s !== status)
    setStatusFilter(updated)
    setFilter({ status: updated })
    setPagination({ offset: 0 })
  }

  const handleRoleFilterChange = (roleId: string, checked: boolean) => {
    const updated = checked
      ? [...roleFilter, roleId]
      : roleFilter.filter((r) => r !== roleId)
    setRoleFilter(updated)
    setFilter({ role: updated })
    setPagination({ offset: 0 })
  }

  const handlePageChange = (newOffset: number) => {
    setPagination({ offset: newOffset })
  }

  const handleLimitChange = (newLimit: number) => {
    setPagination({ limit: newLimit, offset: 0 })
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUserIds(users.map((user) => user.id))
    } else {
      setSelectedUserIds([])
    }
  }

  const handleSelectUser = (userId: string, checked: boolean) => {
    const updated = checked
      ? [...selectedUserIds, userId]
      : selectedUserIds.filter((id) => id !== userId)
    setSelectedUserIds(updated)
  }

  const handleBulkAction = async (action: string) => {
    if (selectedUserIds.length === 0) {
      toast({
        title: 'No users selected',
        description: 'Please select at least one user to perform this action.',
        variant: 'destructive',
      })
      return
    }

    setBulkAction(action)
    setShowBulkConfirm(true)
  }

  const executeBulkAction = async () => {
    try {
      await runBulkOperation({
        action: bulkAction as any,
        userIds: selectedUserIds,
      })

      toast({
        title: 'Success',
        description: `Bulk ${bulkAction} completed successfully.`,
      })

      setSelectedUserIds([])
      setShowBulkConfirm(false)
      fetchUsers()
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to perform bulk action: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      })
    }
  }

  const handleBulkInvite = async () => {
    const emails = inviteEmails
      .split('\n')
      .map((email) => email.trim())
      .filter((email) => email && email.includes('@'))

    if (emails.length === 0) {
      toast({
        title: 'Invalid emails',
        description: 'Please enter valid email addresses.',
        variant: 'destructive',
      })
      return
    }

    try {
      await runBulkOperation({
        action: 'invite',
        userIds: emails,
        params: { emails },
      })

      toast({
        title: 'Invitations sent',
        description: `${emails.length} invitation(s) sent successfully.`,
      })

      setShowBulkInvite(false)
      setInviteEmails('')
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to send invitations: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      })
    }
  }

  const handleExportUsers = () => {
    const csvContent = [
      'ID,Email,Name,Role,Status,Tenant,Last Login,Created At',
      ...users.map((user) =>
        [
          user.id,
          user.email,
          user.name,
          user.role.displayName,
          user.status,
          user.tenantName || '',
          user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : '',
          user.createdAt,
        ].join(',')
      ),
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
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
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
            <Upload className="mr-2 h-4 w-4" />
            Bulk Invite
          </Button>
          <Button variant="outline" onClick={handleExportUsers}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => window.location.href = '/users/create'}>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
              {statusFilter.length > 0 || roleFilter.length > 0 ? (
                <Badge variant="secondary" className="ml-2 h-5 px-1">
                  {statusFilter.length + roleFilter.length}
                </Badge>
              ) : null}
            </Button>
            <Button variant="outline" onClick={() => fetchUsers()} disabled={loading.fetchUsers}>
              <RefreshCw className={`h-4 w-4 ${loading.fetchUsers ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 text-sm font-medium">Status</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      Select Status
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                      <DropdownMenuCheckboxItem
                        key={status}
                        checked={statusFilter.includes(status as UserStatus)}
                        onCheckedChange={(checked) => handleStatusFilterChange(status as UserStatus, checked)}
                      >
                        {config.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div>
                <Label className="mb-2 text-sm font-medium">Role</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      Select Role
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>Filter by Role</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {userRoles.map((role) => (
                      <DropdownMenuCheckboxItem
                        key={role.id}
                        checked={roleFilter.includes(role.id)}
                        onCheckedChange={(checked) => handleRoleFilterChange(role.id, checked)}
                      >
                        {role.displayName}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
        </CardHeader>

        {selectedUserIds.length > 0 && (
          <div className="border-t px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedUserIds.length} user{selectedUserIds.length > 1 ? 's' : ''} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedUserIds([])}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Bulk Actions
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleBulkAction('activate')}>
                      <UserCheck className="mr-2 h-4 w-4" />
                      Activate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkAction('deactivate')}>
                      <UserMinus className="mr-2 h-4 w-4" />
                      Deactivate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkAction('invite')}>
                      <Send className="mr-2 h-4 w-4" />
                      Send Invite
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleBulkAction('delete')}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        )}

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
                  ? 'Try adjusting your filters'
                  : 'Get started by adding your first user'}
              </p>
              {!searchQuery && statusFilter.length === 0 && roleFilter.length === 0 && (
                <Button className="mt-4" onClick={() => window.location.href = '/users/create'}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={selectedUserIds.length === users.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedUserIds.includes(user.id)}
                          onChange={(e) => handleSelectUser(user.id, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar} alt={user.name} />
                            <AvatarFallback>
                              {user.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role.displayName}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_CONFIG[user.status].color}>
                          {STATUS_CONFIG[user.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.tenantName || 'Unknown'}</TableCell>
                      <TableCell>
                        {user.lastLoginAt
                          ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => (window.location.href = `/users/${user.id}`)}
                            >
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => (window.location.href = `/users/${user.id}/edit`)}
                            >
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleBulkAction('delete')}
                              className="text-destructive"
                            >
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between px-4 py-2 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Showing {Math.min(userPagination.offset + 1, totalUsers)} to{' '}
                    {Math.min(userPagination.offset + userPagination.limit, totalUsers)} of {totalUsers} users
                  </span>
                  <Select
                    value={String(userPagination.limit)}
                    onValueChange={(value) => handleLimitChange(Number(value))}
                  >
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGINATION_LIMITS.map((limit) => (
                        <SelectItem key={limit} value={String(limit)}>
                          {limit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(0)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(userPagination.offset - userPagination.limit)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-3 text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(userPagination.offset + userPagination.limit)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange((totalPages - 1) * userPagination.limit)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showBulkConfirm} onOpenChange={setShowBulkConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bulk Action</DialogTitle>
            <DialogDescription>
              Are you sure you want to {bulkAction} {selectedUserIds.length} user(s)? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={executeBulkAction} disabled={loading.bulkUsers}>
              {loading.bulkUsers ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `${bulkAction.charAt(0).toUpperCase() + bulkAction.slice(1)} Users`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkInvite} onOpenChange={setShowBulkInvite}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Invite Users</DialogTitle>
            <DialogDescription>
              Enter email addresses, one per line. We'll send invitation emails to all addresses.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="emails">Email Addresses</Label>
              <textarea
                id="emails"
                className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
                value={inviteEmails}
                onChange={(e) => setInviteEmails(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkInvite(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkInvite} disabled={!inviteEmails.trim()}>
              <Send className="mr-2 h-4 w-4" />
              Send Invitations
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
