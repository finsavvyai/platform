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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { Progress } from '@/components/ui/progress'
import {
  AlertTriangle,
  Shield,
  ShieldCheck,
  Key,
  Database,
  Globe,
  Lock,
  Unlock,
  Activity,
  Download,
  Upload,
  Users,
  Server,
  FileText,
  Eye,
  EyeOff,
  Copy,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tenant, TenantSettings } from '@/types/user-management'

const securitySchema = z.object({
  encryptionEnabled: z.boolean(),
  encryptionKeyId: z.string().optional(),
  dataResidency: z.enum(['us', 'eu', 'apac', 'global']),
  auditLogRetention: z.number().min(30).max(2555),
  sessionSecurity: z.object({
    requireIPWhitelist: z.boolean(),
    allowedIPRanges: z.string().optional(),
    enforceGeoFencing: z.boolean(),
    allowedRegions: z.array(z.string()).optional(),
    sessionTimeoutMinutes: z.number().min(5).max(1440),
  }),
  compliance: z.object({
    gdprCompliant: z.boolean(),
    hipaaCompliant: z.boolean(),
    soc2Compliant: z.boolean(),
    pciDssCompliant: z.boolean(),
    dataProcessingAgreement: z.boolean(),
  }),
  backup: z.object({
    enabled: z.boolean(),
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    retentionDays: z.number().min(7).max(365),
    encryptedBackup: z.boolean(),
    crossRegionBackup: z.boolean(),
  }),
  isolation: z.object({
    strictIsolation: z.boolean(),
    sharedResources: z.array(z.string()),
    resourceQuotas: z.object({
      maxCPU: z.number(),
      maxMemory: z.number(),
      maxStorage: z.number(),
      maxAPIRequests: z.number(),
    }),
  }),
})

type SecurityFormData = z.infer<typeof securitySchema>

interface SecurityMetric {
  label: string
  value: string | number
  status: 'healthy' | 'warning' | 'critical'
  description: string
}

interface ComplianceReport {
  framework: string
  status: 'compliant' | 'non-compliant' | 'pending'
  lastAudit: string
  score: number
  issues: Array<{
    severity: 'high' | 'medium' | 'low'
    description: string
    recommendation: string
  }>
}

interface TenantSecurityPanelProps {
  tenant: Tenant
  onUpdate: (updates: Partial<Tenant>) => void
}

export function TenantSecurityPanel({ tenant, onUpdate }: TenantSecurityPanelProps) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('overview')
  const [isLoading, setIsLoading] = useState(false)
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetric[]>([])
  const [complianceReports, setComplianceReports] = useState<ComplianceReport[]>([])
  const [isRotatingKeys, setIsRotatingKeys] = useState(false)
  const [isExportingData, setIsExportingData] = useState(false)
  const [showEncryptionKey, setShowEncryptionKey] = useState(false)

  const form = useForm<SecurityFormData>({
    resolver: zodResolver(securitySchema),
    defaultValues: {
      encryptionEnabled: true,
      encryptionKeyId: '',
      dataResidency: 'us',
      auditLogRetention: 365,
      sessionSecurity: {
        requireIPWhitelist: false,
        allowedIPRanges: '',
        enforceGeoFencing: false,
        allowedRegions: [],
        sessionTimeoutMinutes: 60,
      },
      compliance: {
        gdprCompliant: false,
        hipaaCompliant: false,
        soc2Compliant: false,
        pciDssCompliant: false,
        dataProcessingAgreement: false,
      },
      backup: {
        enabled: true,
        frequency: 'daily',
        retentionDays: 30,
        encryptedBackup: true,
        crossRegionBackup: false,
      },
      isolation: {
        strictIsolation: true,
        sharedResources: [],
        resourceQuotas: {
          maxCPU: 4,
          maxMemory: 8192,
          maxStorage: 100,
          maxAPIRequests: 10000,
        },
      },
    },
  })

  useEffect(() => {
    fetchSecurityData()
  }, [tenant.id])

  const fetchSecurityData = async () => {
    try {
      // Mock security metrics
      const mockMetrics: SecurityMetric[] = [
        {
          label: 'Data Encryption',
          value: 'AES-256-GCM',
          status: 'healthy',
          description: 'All tenant data is encrypted at rest and in transit',
        },
        {
          label: 'Isolation Level',
          value: 'Strict',
          status: 'healthy',
          description: 'Tenant is isolated with dedicated resources',
        },
        {
          label: 'Audit Coverage',
          value: '100%',
          status: 'healthy',
          description: 'All actions are logged and monitored',
        },
        {
          label: 'Access Control',
          value: 'RBAC',
          status: 'healthy',
          description: 'Role-based access control is enforced',
        },
      ]

      const mockCompliance: ComplianceReport[] = [
        {
          framework: 'GDPR',
          status: 'compliant',
          lastAudit: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
          score: 98,
          issues: [],
        },
        {
          framework: 'SOC 2 Type II',
          status: 'compliant',
          lastAudit: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
          score: 95,
          issues: [
            {
              severity: 'low',
              description: 'Document response time for data requests',
              recommendation: 'Implement automated response system',
            },
          ],
        },
      ]

      setSecurityMetrics(mockMetrics)
      setComplianceReports(mockCompliance)
    } catch (error) {
      console.error('Failed to fetch security data:', error)
    }
  }

  const handleSecurityUpdate = async (data: SecurityFormData) => {
    setIsLoading(true)
    try {
      // Update tenant security settings
      const response = await fetch(`/api/tenants/${tenant.id}/security`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to update security settings')
      }

      toast({
        title: 'Security settings updated',
        description: 'Tenant security settings have been updated successfully.',
      })

      onUpdate({
        ...tenant,
        settings: {
          ...tenant.settings,
          ...data,
        },
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

  const handleRotateEncryptionKey = async () => {
    setIsRotatingKeys(true)
    try {
      const response = await fetch(`/api/tenants/${tenant.id}/rotate-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error('Failed to rotate encryption keys')
      }

      const { newKeyId } = await response.json()

      form.setValue('encryptionKeyId', newKeyId)

      toast({
        title: 'Encryption keys rotated',
        description: 'New encryption key has been generated and applied.',
      })
    } catch (error) {
      toast({
        title: 'Failed to rotate keys',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsRotatingKeys(false)
    }
  }

  const handleExportAuditLogs = async () => {
    setIsExportingData(true)
    try {
      const response = await fetch(`/api/tenants/${tenant.id}/export-audit-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error('Failed to export audit logs')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${tenant.id}-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast({
        title: 'Audit logs exported',
        description: 'Audit logs have been downloaded successfully.',
      })
    } catch (error) {
      toast({
        title: 'Failed to export logs',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsExportingData(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'compliant':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning':
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'critical':
      case 'non-compliant':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Info className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'compliant':
        return 'text-green-600 bg-green-50'
      case 'warning':
      case 'pending':
        return 'text-yellow-600 bg-yellow-50'
      case 'critical':
      case 'non-compliant':
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
            Tenant Security Center
          </CardTitle>
          <CardDescription>
            Manage security, compliance, and isolation settings for {tenant.displayName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="encryption">Encryption</TabsTrigger>
              <TabsTrigger value="isolation">Isolation</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="audit">Audit</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {securityMetrics.map((metric, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(metric.status)}
                          <span className="text-sm font-medium">{metric.label}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={getStatusColor(metric.status)}
                        >
                          {metric.value}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {metric.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-3">Resource Quotas</h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>CPU Usage</span>
                      <span>{tenant.usage.users} / {tenant.limits.users} vCPUs</span>
                    </div>
                    <Progress value={(tenant.usage.users / tenant.limits.users) * 100} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Storage</span>
                      <span>{tenant.usage.storage}GB / {tenant.limits.storage}GB</span>
                    </div>
                    <Progress value={(tenant.usage.storage / tenant.limits.storage) * 100} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>API Requests</span>
                      <span>{tenant.usage.apiCalls} / {tenant.limits.apiCalls}</span>
                    </div>
                    <Progress value={(tenant.usage.apiCalls / tenant.limits.apiCalls) * 100} />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="encryption" className="space-y-4">
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>End-to-End Encryption</AlertTitle>
                <AlertDescription>
                  Your tenant data is encrypted using AES-256-GCM at rest and TLS 1.3 in transit.
                </AlertDescription>
              </Alert>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSecurityUpdate)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="encryptionEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable Encryption</FormLabel>
                          <FormDescription>
                            Encrypt all tenant data with tenant-specific keys
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="encryptionKeyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Encryption Key ID</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input
                              {...field}
                              type={showEncryptionKey ? 'text' : 'password'}
                              placeholder="Key will be generated automatically"
                              readOnly
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setShowEncryptionKey(!showEncryptionKey)}
                          >
                            {showEncryptionKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleRotateEncryptionKey}
                            disabled={isRotatingKeys}
                          >
                            <Key className="h-4 w-4 mr-2" />
                            {isRotatingKeys ? 'Rotating...' : 'Rotate Key'}
                          </Button>
                        </div>
                        <FormDescription>
                          Current encryption key identifier
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dataResidency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Residency Region</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select region" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="us">United States</SelectItem>
                            <SelectItem value="eu">European Union</SelectItem>
                            <SelectItem value="apac">Asia Pacific</SelectItem>
                            <SelectItem value="global">Global</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Geographic location where your data will be stored
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Saving...' : 'Update Encryption Settings'}
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="isolation" className="space-y-4">
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertTitle>Tenant Isolation</AlertTitle>
                <AlertDescription>
                  Ensure strict isolation of tenant resources and data.
                </AlertDescription>
              </Alert>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSecurityUpdate)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="isolation.strictIsolation"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Strict Isolation</FormLabel>
                          <FormDescription>
                            Complete isolation of tenant resources with dedicated infrastructure
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div>
                    <h4 className="text-sm font-medium mb-3">Resource Quotas</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="isolation.resourceQuotas.maxCPU"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max CPU (vCPUs)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max="64"
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
                        name="isolation.resourceQuotas.maxMemory"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Memory (MB)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="512"
                                max="65536"
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
                        name="isolation.resourceQuotas.maxStorage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Storage (GB)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max="10000"
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
                        name="isolation.resourceQuotas.maxAPIRequests"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max API Requests / Month</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1000"
                                max="10000000"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Saving...' : 'Update Isolation Settings'}
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="compliance" className="space-y-4">
              <div className="space-y-4">
                {complianceReports.map((report, index) => (
                  <Card key={index}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{report.framework}</CardTitle>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(report.status)}
                          <Badge className={getStatusColor(report.status)}>
                            {report.status}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span>Compliance Score</span>
                          <span className="font-medium">{report.score}/100</span>
                        </div>
                        <Progress value={report.score} />
                        <div className="text-xs text-muted-foreground">
                          Last audit: {new Date(report.lastAudit).toLocaleDateString()}
                        </div>

                        {report.issues.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <h5 className="text-sm font-medium">Identified Issues:</h5>
                            {report.issues.map((issue, idx) => (
                              <Alert key={idx}>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>
                                  <span className={cn(
                                    'font-medium',
                                    issue.severity === 'high' ? 'text-red-600' :
                                    issue.severity === 'medium' ? 'text-yellow-600' : 'text-blue-600'
                                  )}>
                                    [{issue.severity.toUpperCase()}]
                                  </span>
                                  {' '}{issue.description}
                                  <br />
                                  <span className="text-xs">Recommendation: {issue.recommendation}</span>
                                </AlertDescription>
                              </Alert>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSecurityUpdate)} className="space-y-4">
                  <div>
                        <h4 className="text-sm font-medium mb-3">Compliance Frameworks</h4>
                        <div className="space-y-3">
                          <FormField
                            control={form.control}
                            name="compliance.gdprCompliant"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <div>
                                  <FormLabel className="text-sm">GDPR Compliance</FormLabel>
                                  <FormDescription className="text-xs">
                                    General Data Protection Regulation
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="compliance.soc2Compliant"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <div>
                                  <FormLabel className="text-sm">SOC 2 Type II</FormLabel>
                                  <FormDescription className="text-xs">
                                    Service Organization Control 2
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch checked={field.value} onChanged={field.onChange} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </form>
                  </Form>
            </TabsContent>

            <TabsContent value="audit" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium">Audit Logs</h4>
                  <p className="text-xs text-muted-foreground">
                    Track all activities and changes within your tenant
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleExportAuditLogs}
                  disabled={isExportingData}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isExportingData ? 'Exporting...' : 'Export Logs'}
                </Button>
              </div>

              <FormField
                control={form.control}
                name="auditLogRetention"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Log Retention Period (days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="30"
                        max="2555"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      How long to retain audit logs (minimum 30 days)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <h5 className="text-sm font-medium">Recent Audit Events</h5>
                <div className="space-y-2">
                  {[
                    {
                      event: 'User role modified',
                      user: 'admin@example.com',
                      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
                      ip: '192.168.1.100',
                    },
                    {
                      event: 'Security settings updated',
                      user: 'security@example.com',
                      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
                      ip: '192.168.1.101',
                    },
                    {
                      event: 'Encryption key rotated',
                      user: 'system',
                      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
                      ip: 'system',
                    },
                  ].map((event, index) => (
                    <div key={index} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">{event.event}</p>
                        <p className="text-xs text-muted-foreground">
                          by {event.user} from {event.ip}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
