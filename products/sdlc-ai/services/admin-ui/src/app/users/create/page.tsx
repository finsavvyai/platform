'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { ArrowLeft, Check, Loader2, Mail, User, Users, Building } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useUserManagementStore } from '@/store/user-management'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { UserRole, Tenant } from '@/types/user-management'

const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  tenantId: z.string().min(1, 'Please select a tenant'),
  roleId: z.string().min(1, 'Please select a role'),
  department: z.string().optional(),
  location: z.string().optional(),
  managerId: z.string().optional(),
  password: z.string().optional(),
  sendInvite: z.boolean().default(true),
  customMessage: z.string().optional(),
})

type CreateUserForm = z.infer<typeof createUserSchema>

export default function CreateUserPage() {
  const router = useRouter()
  const { toast } = useToast()
  const {
    tenants,
    userRoles,
    users,
    loading,
    errors,
    createUser,
    fetchTenants,
    fetchUserRoles,
    fetchUsers,
  } = useUserManagementStore()

  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      sendInvite: true,
    },
  })

  const watchedTenantId = form.watch('tenantId')
  const watchedRoleId = form.watch('roleId')
  const watchedSendInvite = form.watch('sendInvite')

  useEffect(() => {
    fetchTenants()
    fetchUserRoles()
  }, [fetchTenants, fetchUserRoles])

  useEffect(() => {
    if (watchedTenantId) {
      fetchUsers({ tenant: [watchedTenantId], limit: 1000 })
    }
  }, [watchedTenantId, fetchUsers])

  useEffect(() => {
    const role = userRoles.find((r) => r.id === watchedRoleId)
    setSelectedRole(role || null)
  }, [watchedRoleId, userRoles])

  const onSubmit = async (data: CreateUserForm) => {
    try {
      const payload = {
        email: data.email,
        name: data.name,
        tenantId: data.tenantId,
        role: data.roleId,
        department: data.department,
        location: data.location,
        managerId: data.managerId,
        sendInvite: data.sendInvite,
        password: data.sendInvite ? undefined : data.password,
      }

      await createUser(payload)

      toast({
        title: 'User created successfully',
        description: data.sendInvite
          ? `Invitation sent to ${data.email}`
          : `User ${data.name} has been created`,
      })

      router.push('/users')
    } catch (error) {
      toast({
        title: 'Error creating user',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const filteredUsers = watchedTenantId
    ? users.filter((u) => u.tenantId === watchedTenantId && u.status === 'ACTIVE')
    : []

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create User</h1>
          <p className="text-muted-foreground">Add a new user to the system</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
          <CardDescription>
            Enter the basic information for the new user. Required fields are marked with an asterisk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Full Name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Email Address <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="john@example.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="tenantId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Tenant <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a tenant" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tenants.map((tenant) => (
                            <SelectItem key={tenant.id} value={tenant.id}>
                              <div className="flex items-center gap-2">
                                <Building className="h-4 w-4" />
                                {tenant.displayName}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="roleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Role <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {userRoles
                            .filter((role) => watchedTenantId ? role.tenantId === watchedTenantId : true)
                            .map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4" />
                                  <div>
                                    <div>{role.displayName}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {role.description}
                                    </div>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {selectedRole && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <h4 className="font-semibold mb-3">Role Permissions</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedRole.permissions.map((permission) => (
                        <Badge key={permission.id} variant="secondary">
                          {permission.name}
                        </Badge>
                      ))}
                    </div>
                    {selectedRole.permissions.length === 0 && (
                      <p className="text-sm text-muted-foreground">No permissions assigned to this role</p>
                    )}
                  </CardContent>
                </Card>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <FormControl>
                        <Input placeholder="Engineering" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="New York, USA" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="managerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manager</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a manager (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select a manager if this user reports to someone in the system
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <FormField
                control={form.control}
                name="sendInvite"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Send Invitation Email</FormLabel>
                      <FormDescription>
                        Send an invitation email to the user with login instructions
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {!watchedSendInvite && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Temporary Password <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter a temporary password"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Provide a temporary password that the user can change on first login
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {watchedSendInvite && (
                <FormField
                  control={form.control}
                  name="customMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Message (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add a custom message to the invitation email..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        This message will be included in the invitation email
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex justify-end gap-3 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={loading.createUser}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading.createUser}>
                  {loading.createUser ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating User...
                    </>
                  ) : (
                    <>
                      {watchedSendInvite ? (
                        <>
                          <Mail className="mr-2 h-4 w-4" />
                          Send Invitation
                        </>
                      ) : (
                        <>
                          <User className="mr-2 h-4 w-4" />
                          Create User
                        </>
                      )}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
