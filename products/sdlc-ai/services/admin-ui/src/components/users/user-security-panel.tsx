'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { AlertTriangle, Shield, ShieldCheck, Key, Smartphone, Mail, Clock, UserCheck, UserX } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { User } from '@/types/user-management'

const securitySchema = z.object({
  enforceMFA: z.boolean(),
  passwordPolicy: z.object({
    minLength: z.number().min(8).max(128),
    requireUppercase: z.boolean(),
    requireLowercase: z.boolean(),
    requireNumbers: z.boolean(),
    requireSpecialChars: z.boolean(),
    preventReuse: z.number().min(0).max(24),
    expirationDays: z.number().min(0).max(365),
  }),
  sessionTimeout: z.number().min(5).max(1440),
  maxConcurrentSessions: z.number().min(1).max(10),
  ipWhitelist: z.string().optional(),
  allowedDevices: z.string().optional(),
  securityNotifications: z.object({
    emailOnNewDevice: z.boolean(),
    emailOnFailedLogin: z.boolean(),
    emailOnPasswordChange: z.boolean(),
    smsOnCriticalActions: z.boolean(),
  }),
})

type SecurityFormData = z.infer<typeof securitySchema>

interface SecurityEvent {
  id: string
  type: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'PASSWORD_CHANGE' | 'MFA_ENABLED' | 'MFA_DISABLED' | 'SECURITY_SETTING_CHANGED'
  description: string
  ipAddress: string
  location: string
  device: string
  timestamp: string
  risk: 'low' | 'medium' | 'high' | 'critical'
}

interface SecurityMetrics {
  failedLogins: number
  successfulLogins: number
  uniqueIPs: number
  riskScore: number
  lastSecurityScan: string
  vulnerabilities: Array<{
    type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    description: string
  }>
}

interface UserSecurityPanelProps {
  user: User
  onUpdate: (updates: Partial<User>) => void
}

export function UserSecurityPanel({ user, onUpdate }: UserSecurityPanelProps) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('overview')
  const [isLoading, setIsLoading] = useState(false)
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([])
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetrics | null>(null)
  const [isResettingMFA, setIsResettingMFA] = useState(false)
  const [isSendingResetLink, setIsSendingResetLink] = useState(false)
  const [isImpersonating, setIsImpersonating] = useState(false)

  const form = useForm<SecurityFormData>({
    resolver: zodResolver(securitySchema),
    defaultValues: {
      enforceMFA: false,
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        preventReuse: 5,
        expirationDays: 90,
      },
      sessionTimeout: 60,
      maxConcurrentSessions: 3,
      ipWhitelist: '',
      allowedDevices: '',
      securityNotifications: {
        emailOnNewDevice: true,
        emailOnFailedLogin: true,
        emailOnPasswordChange: true,
        smsOnCriticalActions: false,
      },
    },
  })

  useEffect(() => {
    // Fetch security events and metrics
    fetchSecurityData()
  }, [user.id])

  const fetchSecurityData = async () => {
    try {
      // Mock data - replace with actual API calls
      const mockEvents: SecurityEvent[] = [
        {
          id: '1',
          type: 'LOGIN_SUCCESS',
          description: 'Successful login from Chrome on Windows',
          ipAddress: '192.168.1.100',
          location: 'New York, US',
          device: 'Chrome 119 / Windows 10',
          timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
          risk: 'low',
        },
        {
          id: '2',
          type: 'LOGIN_FAILED',
          description: 'Failed login attempt - incorrect password',
          ipAddress: '185.220.101.10',
          location: 'Unknown',
          device: 'Unknown',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          risk: 'medium',
        },
      ]

      const mockMetrics: SecurityMetrics = {
        failedLogins: 3,
        successfulLogins: 127,
        uniqueIPs: 5,
        riskScore: 25,
        lastSecurityScan: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        vulnerabilities: [],
      }

      setSecurityEvents(mockEvents)
      setSecurityMetrics(mockMetrics)
    } catch (error) {
      console.error('Failed to fetch security data:', error)
    }
  }

  const handleSecurityUpdate = async (data: SecurityFormData) => {
    setIsLoading(true)
    try {
      // Update user security settings
      await fetch(`/api/users/${user.id}/security`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      toast({
        title: 'Security settings updated',
        description: 'User security settings have been updated successfully.',
      })

      onUpdate({
        ...user,
        mfaEnabled: data.enforceMFA,
      })
    } catch (error) {
      toast({
        title: 'Failed to update security settings',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetMFA = async () => {
    setIsResettingMFA(true)
    try {
      await fetch(`/api/users/${user.id}/reset-mfa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      toast({
        title: 'MFA reset',
        description: 'MFA has been reset. User will need to set it up again.',
      })

      onUpdate({ ...user, mfaEnabled: false })
    } catch (error) {
      toast({
        title: 'Failed to reset MFA',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsResettingMFA(false)
    }
  }

  const handleSendPasswordReset = async () => {
    setIsSendingResetLink(true)
    try {
      await fetch(`/api/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      toast({
        title: 'Password reset sent',
        description: `Password reset link has been sent to ${user.email}`,
      })
    } catch (error) {
      toast({
        title: 'Failed to send reset link',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsSendingResetLink(false)
    }
  }

  const handleImpersonateUser = async () => {
    setIsImpersonating(true)
    try {
      const response = await fetch(`/api/admin/impersonate/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        const { impersonationToken } = await response.json()

        // Store impersonation token and redirect
        document.cookie = `impersonation_token=${impersonationToken}; path=/; secure; httponly; samesite=strict`

        toast({
          title: 'Impersonation started',
          description: `You are now impersonating ${user.name}`,
        })

        // Redirect to user's view
        window.open(`/dashboard?impersonate=${user.id}`, '_blank')
      }
    } catch (error) {
      toast({
        title: 'Failed to start impersonation',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsImpersonating(false)
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'text-green-600 bg-green-50'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50'
      case 'high':
        return 'text-orange-600 bg-orange-50'
      case 'critical':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Overview
          </CardTitle>
          <CardDescription>
            Manage security settings and monitor security events for {user.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {securityMetrics && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">Logins (30d)</span>
                      </div>
                      <div className="mt-2 text-2xl font-bold">{securityMetrics.successfulLogins}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <UserX className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium">Failed Logins</span>
                      </div>
                      <div className="mt-2 text-2xl font-bold">{securityMetrics.failedLogins}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">Risk Score</span>
                      </div>
                      <div className="mt-2 text-2xl font-bold">{securityMetrics.riskScore}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-purple-600" />
                        <span className="text-sm font-medium">Unique IPs</span>
                      </div>
                      <div className="mt-2 text-2xl font-bold">{securityMetrics.uniqueIPs}</div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Multi-Factor Authentication</span>
                  <Badge variant={user.mfaEnabled ? 'default' : 'destructive'}>
                    {user.mfaEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Email Verification</span>
                  <Badge variant={user.emailVerified ? 'default' : 'secondary'}>
                    {user.emailVerified ? 'Verified' : 'Not Verified'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Account Status</span>
                  <Badge
                    variant={user.status === 'ACTIVE' ? 'default' : 'destructive'}
                  >
                    {user.status}
                  </Badge>
                </div>

                {securityMetrics?.lastSecurityScan && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Last Security Scan</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(securityMetrics.lastSecurityScan).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {securityMetrics?.vulnerabilities && securityMetrics.vulnerabilities.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Security Vulnerabilities Detected</AlertTitle>
                  <AlertDescription>
                    {securityMetrics.vulnerabilities.length} security issue(s) require attention.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSecurityUpdate)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="enforceMFA"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enforce MFA</FormLabel>
                          <FormDescription>
                            Require multi-factor authentication for this user
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="sessionTimeout"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Session Timeout (minutes)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="5"
                              max="1440"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Session will expire after this period of inactivity
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="maxConcurrentSessions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Concurrent Sessions</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="10"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum number of active sessions allowed
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-3">Password Policy</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="passwordPolicy.minLength"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Minimum Length</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="8"
                                max="128"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="passwordPolicy.expirationDays"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expiration (days)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                max="365"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>0 for no expiration</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 mt-4">
                      <FormField
                        control={form.control}
                        name="passwordPolicy.requireUppercase"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                            <FormLabel className="text-sm">Require Uppercase</FormLabel>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="passwordPolicy.requireNumbers"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                            <FormLabel className="text-sm">Require Numbers</FormLabel>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Saving...' : 'Update Security Settings'}
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="activity" className="space-y-4">
              <div className="space-y-3">
                {securityEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'px-2 py-1 rounded text-xs font-medium',
                        getRiskColor(event.risk)
                      )}>
                        {event.risk.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{event.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.ipAddress} • {event.location} • {event.device}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="actions" className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Administrative Actions</AlertTitle>
                <AlertDescription>
                  These actions require elevated permissions and will be logged.
                </AlertDescription>
              </Alert>

              <div className="grid gap-3 md:grid-cols-2">
                <Button
                  variant="outline"
                  onClick={handleSendPasswordReset}
                  disabled={isSendingResetLink}
                  className="justify-start"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {isSendingResetLink ? 'Sending...' : 'Send Password Reset'}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleResetMFA}
                  disabled={isResettingMFA || !user.mfaEnabled}
                  className="justify-start"
                >
                  <Smartphone className="h-4 w-4 mr-2" />
                  {isResettingMFA ? 'Resetting...' : 'Reset MFA'}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleImpersonateUser}
                  disabled={isImpersonating}
                  className="justify-start"
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  {isImpersonating ? 'Starting...' : 'Impersonate User'}
                </Button>

                <Button
                  variant="destructive"
                  onClick={() => {
                    // Handle lock account
                  }}
                  className="justify-start"
                >
                  <UserX className="h-4 w-4 mr-2" />
                  Lock Account
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
