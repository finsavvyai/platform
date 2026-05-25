'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { Shield } from 'lucide-react'

import {
  securitySettingsSchema,
  SecuritySettingsFormData,
  SecurityAuditLog,
  ComplianceReport,
  TenantSecuritySettingsProps,
} from './types'
import { defaultFormValues, getSecurityScore } from './helpers'
import { OverviewTab } from './overview-tab'
import { EncryptionTab } from './encryption-tab'
import { IsolationTab } from './isolation-tab'
import { ComplianceTab } from './compliance-tab'
import { AuditTab } from './audit-tab'

export function TenantSecuritySettings({ tenant, onUpdate }: TenantSecuritySettingsProps) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('overview')
  const [isLoading, setIsLoading] = useState(false)
  const [auditLogs, setAuditLogs] = useState<SecurityAuditLog[]>([])
  const [complianceReports, setComplianceReports] = useState<ComplianceReport[]>([])
  const [showEncryptionKey, setShowEncryptionKey] = useState(false)
  const [isRotatingKey, setIsRotatingKey] = useState(false)

  const form = useForm<SecuritySettingsFormData>({
    resolver: zodResolver(securitySettingsSchema as any),
    defaultValues: defaultFormValues,
  })

  useEffect(() => { fetchSecurityData() }, [tenant.id])

  const fetchSecurityData = async () => {
    try {
      setAuditLogs([
        { id: '1', timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), action: 'DATA_ACCESS', resource: 'documents/123', user: 'john.doe@example.com', ipAddress: '192.168.1.100', outcome: 'success', risk: 'low', details: 'Accessed confidential document' },
        { id: '2', timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), action: 'SECURITY_SETTING_CHANGE', resource: 'tenant/settings', user: 'admin@example.com', ipAddress: '10.0.0.50', outcome: 'success', risk: 'high', details: 'Modified encryption settings' },
      ])
      setComplianceReports([
        { framework: 'GDPR', status: 'compliant', score: 98, lastAssessment: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(), findings: [] },
        { framework: 'SOC 2', status: 'partial', score: 85, lastAssessment: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(), findings: [{ category: 'Access Control', severity: 'medium', description: 'Missing multi-factor authentication for some users', recommendation: 'Enable MFA for all privileged users' }] },
      ])
    } catch (error) { console.error('Failed to fetch security data:', error) }
  }

  const handleSecurityUpdate = async (data: SecuritySettingsFormData) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/tenants/${tenant.id}/security`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!response.ok) throw new Error('Failed to update security settings')
      toast({ title: 'Security settings updated', description: 'Tenant security settings have been updated successfully.' })
      onUpdate({ ...tenant, settings: { ...tenant.settings, enforceMFA: data.accessControl.mfaRequired, sessionTimeout: data.accessControl.sessionTimeout } })
    } catch (error) {
      toast({ title: 'Failed to update security settings', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' })
    } finally { setIsLoading(false) }
  }

  const handleRotateEncryptionKey = async () => {
    setIsRotatingKey(true)
    try {
      const response = await fetch(`/api/tenants/${tenant.id}/rotate-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      if (!response.ok) throw new Error('Failed to rotate encryption key')
      toast({ title: 'Encryption key rotated', description: 'Tenant encryption key has been rotated successfully.' })
    } catch (error) {
      toast({ title: 'Failed to rotate key', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' })
    } finally { setIsRotatingKey(false) }
  }

  const securityScore = getSecurityScore(form.getValues())

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Tenant Security Settings</CardTitle>
          <CardDescription>Configure security settings for tenant {tenant.name} with strict isolation controls</CardDescription>
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
            <TabsContent value="overview"><OverviewTab securityScore={securityScore} /></TabsContent>
            <TabsContent value="encryption">
              <EncryptionTab form={form} onSubmit={handleSecurityUpdate} isLoading={isLoading}
                showEncryptionKey={showEncryptionKey} setShowEncryptionKey={setShowEncryptionKey}
                isRotatingKey={isRotatingKey} onRotateKey={handleRotateEncryptionKey} />
            </TabsContent>
            <TabsContent value="isolation"><IsolationTab form={form} onSubmit={handleSecurityUpdate} isLoading={isLoading} /></TabsContent>
            <TabsContent value="compliance"><ComplianceTab complianceReports={complianceReports} /></TabsContent>
            <TabsContent value="audit"><AuditTab auditLogs={auditLogs} /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
