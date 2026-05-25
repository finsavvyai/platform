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
  Shield,
  ShieldCheck,
  ShieldAlert,
  Database,
  Lock,
  Unlock,
  Key,
  FileKey,
  Users,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tenant } from '@/types/user-management'

const securitySettingsSchema = z.object({
  encryption: z.object({
    atRest: z.object({
      enabled: z.boolean(),
      algorithm: z.string(),
      keyRotationDays: z.number().min(1).max(365),
    }),
    inTransit: z.object({
      enforceTLS: z.boolean(),
      minVersion: z.string(),
      cipherSuites: z.array(z.string()),
    }),
    keyManagement: z.object({
      provider: z.string(),
      hsmEnabled: z.boolean(),
      keyIsolation: z.boolean(),
    }),
  }),
  isolation: z.object({
    databaseIsolation: z.boolean(),
    storageIsolation: z.boolean(),
    networkIsolation: z.boolean(),
    computeIsolation: z.boolean(),
    auditTrail: z.boolean(),
  }),
  accessControl: z.object({
    rbacEnabled: z.boolean(),
    ssoEnabled: z.boolean(),
    mfaRequired: z.boolean(),
    sessionTimeout: z.number().min(5).max(1440),
    ipWhitelist: z.string().optional(),
    deviceWhitelist: z.string().optional(),
  }),
  compliance: z.object({
    gdpr: z.boolean(),
    hipaa: z.boolean(),
    soc2: z.boolean(),
    iso27001: z.boolean(),
    dataResidency: z.string(),
    retentionPolicy: z.object({
      enabled: z.boolean(),
      defaultPeriod: z.number().min(30).max(2555),
      legalHold: z.boolean(),
    }),
  }),
})

type SecuritySettingsFormData = z.infer<typeof securitySettingsSchema>

interface SecurityAuditLog {
  id: string
  timestamp: string
  action: string
  resource: string
  user: string
  ipAddress: string
  outcome: 'success' | 'failure'
  risk: 'low' | 'medium' | 'high' | 'critical'
  details: string
}

interface ComplianceReport {
  framework: string
  status: 'compliant' | 'non-compliant' | 'partial'
  score: number
  lastAssessment: string
  findings: Array<{
    category: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    description: string
    recommendation: string
  }>
}

interface TenantSecuritySettingsProps {
  tenant: Tenant
  onUpdate: (updates: Partial<Tenant>) => void
}

export function TenantSecuritySettings({ tenant, onUpdate }: TenantSecuritySettingsProps) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('overview')
  const [isLoading, setIsLoading] = useState(false)
  const [auditLogs, setAuditLogs] = useState<SecurityAuditLog[]>([])
  const [complianceReports, setComplianceReports] = useState<ComplianceReport[]>([])
  const [showEncryptionKey, setShowEncryptionKey] = useState(false)
  const [isRotatingKey, setIsRotatingKey] = useState(false)

  const form = useForm<SecuritySettingsFormData>({
    resolver: zodResolver(securitySettingsSchema),
    defaultValues: {
      encryption: {
        atRest: {
          enabled: true,
          algorithm: 'AES-256-GCM',
          keyRotationDays: 90,
        },
        inTransit: {
          enforceTLS: true,
          minVersion: '1.3',
          cipherSuites: ['TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256'],
        },
        keyManagement: {
          provider: 'aws-kms',
          hsmEnabled: true,
          keyIsolation: true,
        },
      },
      isolation: {
        databaseIsolation: true,
        storageIsolation: true,
        networkIsolation: true,
        computeIsolation: false,
        auditTrail: true,
      },
      accessControl: {
        rbacEnabled: true,
        ssoEnabled: false,
        mfaRequired: true,
        sessionTimeout: 60,
        ipWhitelist: '',
        deviceWhitelist: '',
      },
      compliance: {
        gdpr: true,
        hipaa: false,
        soc2: false,
        iso27001: false,
        dataResidency: 'us-east-1',
        retentionPolicy: {
          enabled: true,
          defaultPeriod: 2555,
          legalHold: true,
        },
      },
    },
  })

  useEffect(() => {
    fetchSecurityData()
  }, [tenant.id])

  const fetchSecurityData = async () => {
    try {
      // Mock data - replace with actual API calls
      const mockLogs: SecurityAuditLog[] = [
        {
          id: '1',
          timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
          action: 'DATA_ACCESS',
          resource: 'documents/123',
          user: 'john.doe@example.com',
          ipAddress: '192.168.1.100',
          outcome: 'success',
          risk: 'low',
          details: 'Accessed confidential document',
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          action: 'SECURITY_SETTING_CHANGE',
          resource: 'tenant/settings',
          user: 'admin@example.com',
          ipAddress: '10.0.0.50',
          outcome: 'success',
          risk: 'high',
          details: 'Modified encryption settings',
        },
      ]

      const mockReports: ComplianceReport[] = [
        {
          framework: 'GDPR',
          status: 'compliant',
          score: 98,
          lastAssessment: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
          findings: [],
        },
        {
          framework: 'SOC 2',
          status: 'partial',
          score: 85,
          lastAssessment: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
          findings: [
            {
              category: 'Access Control',
              severity: 'medium',
              description: 'Missing multi-factor authentication for some users',
              recommendation: 'Enable MFA for all privileged users',
            },
          ],
        },
      ]

      setAuditLogs(mockLogs)
      setComplianceReports(mockReports)
    } catch (error) {
      console.error('Failed to fetch security data:', error)
    }
  }

  const handleSecurityUpdate = async (data: SecuritySettingsFormData) => {
    setIsLoading(true)
    try {
      // Update tenant security settings
      const response = await fetch(`/api/tenants/${tenant.id}/security`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error('Failed to update security settings')

      toast({
        title: 'Security settings updated',
        description: 'Tenant security settings have been updated successfully.',
      })

      onUpdate({
        ...tenant,
        settings: {
          ...tenant.settings,
          requireMFA: data.accessControl.mfaRequired,
          sessionTimeout: data.accessControl.sessionTimeout,
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
    setIsRotatingKey(true)
    try {
      const response = await fetch(`/api/tenants/${tenant.id}/rotate-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) throw new Error('Failed to rotate encryption key')

      toast({
        title: 'Encryption key rotated',
        description: 'Tenant encryption key has been rotated successfully.',
      })
    } catch (error) {
      toast({
        title: 'Failed to rotate key',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsRotatingKey(false)
    }
  }

  const getSecurityScore = () => {
    // Calculate security score based on settings
    const data = form.getValues()
    let score = 0

    if (data.encryption.atRest.enabled) score += 20
    if (data.encryption.inTransit.enforceTLS) score += 15
    if (data.encryption.keyManagement.hsmEnabled) score += 15
    if (data.isolation.databaseIsolation) score += 10
    if (data.isolation.storageIsolation) score += 10
    if (data.accessControl.rbacEnabled) score += 10
    if (data.accessControl.ssoEnabled) score += 5
    if (data.accessControl.mfaRequired) score += 10
    if (data.compliance.gdpr) score += 5

    return score
  }

  const getComplianceStatusColor = (status: string) => {
    switch (status) {
      case 'compliant':
        return 'text-green-600 bg-green-50'
      case 'non-compliant':
        return 'text-red-600 bg-red-50'
      case 'partial':
        return 'text-yellow-600 bg-yellow-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const securityScore = getSecurityScore()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Tenant Security Settings
          </CardTitle>
          <CardDescription>
            Configure security settings for tenant {tenant.name} with strict isolation controls
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
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div>
                  <h3 className="font-medium flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                    Security Score
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Overall security posture assessment
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{securityScore}/100</div>
                  <Progress value={securityScore} className="w-32 mt-1" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Encryption Status
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Data at Rest</span>
                        <Badge variant="default">AES-256-GCM</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Data in Transit</span>
                        <Badge variant="default">TLS 1.3</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Key Management</span>
                        <Badge variant="default">HSM</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Isolation Status
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Database</span>
                        <Badge variant="default">Isolated</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Storage</span>
                        <Badge variant="default">Isolated</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Network</span>
                        <Badge variant="default">Isolated</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Alert>
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Tenant Isolation Active</AlertTitle>
                <AlertDescription>
                  This tenant is configured with strict isolation. All data is encrypted with tenant-specific keys and isolated from other tenants.
                </AlertDescription>
              </Alert>
            </TabsContent>

            <TabsContent value="encryption" className="space-y-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSecurityUpdate)} className="space-y-6">
                  <div>
                    <h4 className="text-lg font-medium mb-4">Data at Rest Encryption</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="encryption.atRest.enabled"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Enable Encryption</FormLabel>
                              <FormDescription>
                                Encrypt all data stored for this tenant
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
                        name="encryption.atRest.algorithm"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Encryption Algorithm</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select algorithm" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="AES-256-GCM">AES-256-GCM</SelectItem>
                                <SelectItem value="AES-128-GCM">AES-128-GCM</SelectItem>
                                <SelectItem value="ChaCha20-Poly1305">ChaCha20-Poly1305</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="encryption.atRest.keyRotationDays"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Key Rotation (days)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max="365"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              Automatically rotate encryption keys
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="text-lg font-medium mb-4">Key Management</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="encryption.keyManagement.provider"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Key Provider</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="aws-kms">AWS KMS</SelectItem>
                                <SelectItem value="azure-kv">Azure Key Vault</SelectItem>
                                <SelectItem value="gcp-kms">Google Cloud KMS</SelectItem>
                                <SelectItem value="hashicorp-vault">HashiCorp Vault</SelectItem>
                                <SelectItem value="cloudflare-secrets">Cloudflare Secrets</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="encryption.keyManagement.hsmEnabled"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">HSM Enabled</FormLabel>
                              <FormDescription>
                                Use Hardware Security Module for key storage
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="mt-4 p-4 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Tenant Encryption Key</p>
                          <p className="text-sm text-muted-foreground">
                            Last rotated: 30 days ago
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowEncryptionKey(!showEncryptionKey)}
                          >
                            {showEncryptionKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRotateEncryptionKey}
                            disabled={isRotatingKey}
                          >
                            {isRotatingKey ? 'Rotating...' : 'Rotate Key'}
                          </Button>
                        </div>
                      </div>
                      {showEncryptionKey && (
                        <div className="mt-2 p-2 bg-muted rounded">
                          <code className="text-xs">
                            tenant-enc-key-v2-xxxxx-xxxxx-xxxxx-xxxxxxxxxxxx
                          </code>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Saving...' : 'Save Encryption Settings'}
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="isolation" className="space-y-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSecurityUpdate)} className="space-y-4">
                  <h4 className="text-lg font-medium mb-4">Tenant Isolation Controls</h4>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="isolation.databaseIsolation"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Database Isolation</FormLabel>
                            <FormDescription>
                              Separate database schema for this tenant
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
                      name="isolation.storageIsolation"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Storage Isolation</FormLabel>
                            <FormDescription>
                              Dedicated storage bucket for this tenant
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
                      name="isolation.networkIsolation"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Network Isolation</FormLabel>
                            <FormDescription>
                              Isolate network traffic for this tenant
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
                      name="isolation.auditTrail"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Audit Trail</FormLabel>
                            <FormDescription>
                              Log all access to tenant data
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Alert>
                    <Database className="h-4 w-4" />
                    <AlertTitle>Strict Isolation Mode</AlertTitle>
                    <AlertDescription>
                      When enabled, tenant data will be completely isolated at all levels - database, storage, and network. This provides maximum security but may increase operational complexity.
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Saving...' : 'Save Isolation Settings'}
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="compliance" className="space-y-4">
              <div className="space-y-4">
                {complianceReports.map((report) => (
                  <Card key={report.framework}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">{report.framework}</h4>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={getComplianceStatusColor(report.status)}
                          >
                            {report.status.toUpperCase()}
                          </Badge>
                          <span className="text-sm font-medium">{report.score}/100</span>
                        </div>
                      </div>

                      <Progress value={report.score} className="mb-3" />

                      <div className="text-sm text-muted-foreground mb-3">
                        Last assessed: {new Date(report.lastAssessment).toLocaleDateString()}
                      </div>

                      {report.findings.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Findings:</p>
                          {report.findings.map((finding, index) => (
                            <div key={index} className="p-2 rounded border">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium">{finding.category}</span>
                                <Badge
                                  variant="outline"
                                  className={getComplianceStatusColor(finding.severity)}
                                >
                                  {finding.severity}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{finding.description}</p>
                              <p className="text-sm text-blue-600 mt-1">{finding.recommendation}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="audit" className="space-y-4">
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{log.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.user} • {log.ipAddress}
                        </p>
                        <p className="text-xs text-muted-foreground">{log.details}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        {log.outcome === 'success' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <Badge
                          variant="outline"
                          className={getComplianceStatusColor(log.risk)}
                        >
                          {log.risk}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
