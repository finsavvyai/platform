'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Edit,
  Key,
  Loader2,
  Mail,
  MoreHorizontal,
  RefreshCw,
  Shield,
  Trash2,
  User as UserIcon,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useUserManagementStore } from '@/store/user-management'
import { useToast } from '@/hooks/use-toast'
import { Separator } from '@/components/ui/separator'
import type { User, UserStatus } from '@/types/user-management'

const STATUS_CONFIG = {
  ACTIVE: { label: 'Active', color: 'success' as const, icon: UserCheck },
  INACTIVE: { label: 'Inactive', color: 'secondary' as const, icon: UserX },
  SUSPENDED: { label: 'Suspended', color: 'destructive' as const, icon: Ban },
  PENDING: { label: 'Pending', color: 'warning' as const, icon: RefreshCw },
  LOCKED: { label: 'Locked', color: 'destructive' as const, icon: Shield },
}

export default function UserDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const userId = params?.id as string

  const {
    currentUser,
    userActivity,
    loading,
    errors,
    fetchUser,
    fetchUserActivity,
    updateUser,
    deleteUser,
    clearCurrentUser,
  } = useUserManagementStore()

  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{
    title: string
    description: string
    action: () => Promise<void>
    variant?: 'default' | 'destructive'
  } | null>(null)

  useEffect(() => {
    if (userId) {
      fetchUser(userId)
      fetchUserActivity(userId, { limit: 50 })
    }

    return () => {
      clearCurrentUser()
    }
  }, [userId, fetchUser, fetchUserActivity, clearCurrentUser])

  const handleStatusChange = async (newStatus: UserStatus) => {
    if (!currentUser) return

    const action = async () => {
      try {
        await updateUser(currentUser.id, { status: newStatus })
        toast({
          title: 'Status updated',
          description: `User status has been changed to ${STATUS_CONFIG[newStatus].label}`,
        })
        fetchUser(userId)
      } catch (error) {
        toast({
          title: 'Error updating status',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        })
      }
    }

    setConfirmAction({
      title: `Change Status to ${STATUS_CONFIG[newStatus].label}`,
      description: `Are you sure you want to change this user's status to ${STATUS_CONFIG[newStatus].label}?`,
      action,
      variant: newStatus === 'SUSPENDED' || newStatus === 'LOCKED' ? 'destructive' : 'default',
    })
    setShowConfirmDialog(true)
  }

  const handleDeleteUser = async () => {
    if (!currentUser) return

    const action = async () => {
      try {
        await deleteUser(currentUser.id)
        toast({
          title: 'User deleted',
          description: `User ${currentUser.name} has been permanently deleted`,
        })
        router.push('/users')
      } catch (error) {
        toast({
          title: 'Error deleting user',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        })
      }
    }

    setConfirmAction({
      title: 'Delete User',
      description: `Are you sure you want to delete ${currentUser.name}? This action cannot be undone.`,
      action,
      variant: 'destructive',
    })
    setShowConfirmDialog(true)
  }

  const handleResetMFA = async () => {
    if (!currentUser) return

    try {
      await updateUser(currentUser.id, { metadata: { resetMFA: true } })
      toast({
        title: 'MFA Reset',
        description: 'MFA has been reset for this user. They will need to set it up again.',
      })
      fetchUser(userId)
    } catch (error) {
      toast({
        title: 'Error resetting MFA',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleResendInvite = async () => {
    if (!currentUser) return

    try {
      await updateUser(currentUser.id, { metadata: { resendInvite: true } })
      toast({
        title: 'Invitation Sent',
        description: `Invitation has been resent to ${currentUser.email}`,
      })
    } catch (error) {
      toast({
        title: 'Error resending invitation',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  if (loading.fetchUser) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-[200px]" />
            <Skeleton className="h-4 w-[300px]" />
          </div>
        </div>
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-[150px]" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-[200px]" />
                  <Skeleton className="h-4 w-[250px]" />
                  <Skeleton className="h-4 w-[150px]" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (errors.fetchUser || !currentUser) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Error Loading User</CardTitle>
          <CardDescription>{errors.fetchUser || 'User not found'}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </CardFooter>
      </Card>
    )
  }

  const StatusIcon = STATUS_CONFIG[currentUser.status].icon

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">User Details</h1>
            <p className="text-muted-foreground">View and manage user information</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push(`/users/${userId}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit User
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleResetMFA}>
                <Key className="mr-2 h-4 w-4" />
                Reset MFA
              </DropdownMenuItem>
              {currentUser.status === 'PENDING' && (
                <DropdownMenuItem onClick={handleResendInvite}>
                  <Mail className="mr-2 h-4 w-4" />
                  Resend Invite
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleStatusChange('ACTIVE')}
                disabled={currentUser.status === 'ACTIVE'}
              >
                <UserCheck className="mr-2 h-4 w-4" />
                Activate
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleStatusChange('SUSPENDED')}
                disabled={currentUser.status === 'SUSPENDED'}
              >
                <UserX className="mr-2 h-4 w-4" />
                Suspend
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDeleteUser} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-24 w-24">
                <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                <AvatarFallback className="text-2xl">
                  {currentUser.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="mt-4">
                <h3 className="text-xl font-semibold">{currentUser.name}</h3>
                <p className="text-muted-foreground">{currentUser.email}</p>
              </div>
              <Badge variant={STATUS_CONFIG[currentUser.status].color} className="mt-2">
                <StatusIcon className="mr-1 h-3 w-3" />
                {STATUS_CONFIG[currentUser.status].label}
              </Badge>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">User ID</span>
                <span className="font-mono">{currentUser.id}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tenant</span>
                <span>{currentUser.tenantName || 'Unknown'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Department</span>
                <span>{currentUser.department || 'Not set'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Location</span>
                <span>{currentUser.location || 'Not set'}</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Email Verified</span>
                {currentUser.emailVerified ? (
                  <BadgeCheck className="h-4 w-4 text-success" />
                ) : (
                  <Badge variant="destructive">Not Verified</Badge>
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">MFA Enabled</span>
                {currentUser.mfaEnabled ? (
                  <Shield className="h-4 w-4 text-success" />
                ) : (
                  <Badge variant="secondary">Disabled</Badge>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{format(new Date(currentUser.createdAt), 'MMM d, yyyy')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last Login</span>
                <span>
                  {currentUser.lastLoginAt
                    ? format(new Date(currentUser.lastLoginAt), 'MMM d, yyyy HH:mm')
                    : 'Never'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2">
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="permissions">Permissions</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Role Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Users className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <h4 className="font-semibold">{currentUser.role.displayName}</h4>
                      <p className="text-sm text-muted-foreground">
                        Level {currentUser.role.level} • {currentUser.role.permissions.length} permissions
                      </p>
                    </div>
                  </div>
                  {currentUser.role.description && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {currentUser.role.description}
                    </p>
                  )}
                </CardContent>
              </Card>

              {currentUser.managerName && (
                <Card>
                  <CardHeader>
                    <CardTitle>Manager</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {currentUser.managerName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{currentUser.managerName}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {currentUser.directReports && currentUser.directReports.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Direct Reports ({currentUser.directReports.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {currentUser.directReports.map((report) => (
                        <div key={report.id} className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={report.avatar} alt={report.name} />
                            <AvatarFallback>
                              {report.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{report.name}</p>
                            <p className="text-sm text-muted-foreground">{report.email}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="permissions" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Assigned Permissions</CardTitle>
                  <CardDescription>
                    This user has {currentUser.permissions.length} permissions through their role
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {currentUser.permissions.map((permission) => (
                      <div key={permission.id} className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{permission.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {permission.resource} • {permission.action}
                          </p>
                        </div>
                        <Badge variant="outline">{permission.resource}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>
                    Last 50 activities performed by this user
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading.fetchUserActivity ? (
                    <div className="space-y-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center space-x-4">
                          <Skeleton className="h-10 w-10 rounded" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-[250px]" />
                            <Skeleton className="h-3 w-[200px]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : userActivity.length === 0 ? (
                    <div className="text-center py-8">
                      <UserIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-2 text-sm font-semibold">No activity</h3>
                      <p className="text-sm text-muted-foreground">This user has no recent activity</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Action</TableHead>
                          <TableHead>Resource</TableHead>
                          <TableHead>IP Address</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userActivity.map((activity) => (
                          <TableRow key={activity.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {activity.success ? (
                                  <BadgeCheck className="h-4 w-4 text-success" />
                                ) : (
                                  <Badge variant="destructive">Failed</Badge>
                                )}
                                <span>{activity.action}</span>
                              </div>
                            </TableCell>
                            <TableCell>{activity.resource}</TableCell>
                            <TableCell className="font-mono text-sm">{activity.ipAddress}</TableCell>
                            <TableCell>
                              {format(new Date(activity.createdAt), 'MMM d, HH:mm')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmAction?.title}</DialogTitle>
            <DialogDescription>{confirmAction?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              variant={confirmAction?.variant}
              onClick={async () => {
                if (confirmAction) {
                  await confirmAction.action()
                  setShowConfirmDialog(false)
                }
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
