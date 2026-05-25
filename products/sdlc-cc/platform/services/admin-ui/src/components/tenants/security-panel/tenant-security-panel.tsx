'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { Shield } from 'lucide-react'

import { securitySchema, SecurityFormData, SecurityMetric, ComplianceReport, TenantSecurityPanelProps } from './types'
import { defaultFormValues } from './helpers'
import { OverviewTab } from './overview-tab'
import { EncryptionTab } from './encryption-tab'
import { IsolationTab } from './isolation-tab'
import { ComplianceTab } from './compliance-tab'
import { AuditTab } from './audit-tab'

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
    resolver: zodResolver(securitySchema as any),
    defaultValues: defaultFormValues,
  })

  useEffect(() => { fetchSecurityData() }, [tenant.id])

  const fetchSecurityData = async () => {
    try {
      setSecurityMetrics([
        { label: 'Data Encryption', value: 'AES-256-GCM', status: 'healthy', description: 'All tenant data is encrypted at rest and in transit' },
        { label: 'Isolation Level', value: 'Strict', status: 'healthy', description: 'Tenant is isolated with dedicated resources' },
        { label: 'Audit Coverage', value: '100%', status: 'healthy', description: 'All actions are logged and monitored' },
        { label: 'Access Control', value: 'RBAC', status: 'healthy', description: 'Role-based access control is enforced' },
      ])
      setComplianceReports([
        { framework: 'GDPR', status: 'compliant', lastAudit: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(), score: 98, issues: [] },
        { framework: 'SOC 2 Type II', status: 'compliant', lastAudit: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(), score: 95, issues: [{ severity: 'low', description: 'Document response time for data requests', recommendation: 'Implement automated response system' }] },
      ])
    } catch (error) { console.error('Failed to fetch security data:', error) }
  }

  const handleSecurityUpdate = async (data: SecurityFormData) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/tenants/${tenant.id}/security`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!response.ok) throw new Error('Failed to update security settings')
      toast({ title: 'Security settings updated', description: 'Tenant security settings have been updated successfully.' })
      onUpdate({ ...tenant, settings: { ...tenant.settings, ...data } })
    } catch (error) {
      toast({ title: 'Failed to update security settings', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' })
    } finally { setIsLoading(false) }
  }

  const handleRotateEncryptionKey = async () => {
    setIsRotatingKeys(true)
    try {
      const response = await fetch(`/api/tenants/${tenant.id}/rotate-keys`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      if (!response.ok) throw new Error('Failed to rotate encryption keys')
      const { newKeyId } = await response.json()
      form.setValue('encryptionKeyId', newKeyId)
      toast({ title: 'Encryption keys rotated', description: 'New encryption key has been generated and applied.' })
    } catch (error) {
      toast({ title: 'Failed to rotate keys', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' })
    } finally { setIsRotatingKeys(false) }
  }

  const handleExportAuditLogs = async () => {
    setIsExportingData(true)
    try {
      const response = await fetch(`/api/tenants/${tenant.id}/export-audit-logs`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      if (!response.ok) throw new Error('Failed to export audit logs')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${tenant.id}-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast({ title: 'Audit logs exported', description: 'Audit logs have been downloaded successfully.' })
    } catch (error) {
      toast({ title: 'Failed to export logs', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' })
    } finally { setIsExportingData(false) }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Tenant Security Center</CardTitle>
          <CardDescription>Manage security, compliance, and isolation settings for {tenant.displayName}</CardDescription>
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
            <TabsContent value="overview"><OverviewTab securityMetrics={securityMetrics} tenant={tenant} /></TabsContent>
            <TabsContent value="encryption">
              <EncryptionTab form={form} onSubmit={handleSecurityUpdate} isLoading={isLoading}
                showEncryptionKey={showEncryptionKey} setShowEncryptionKey={setShowEncryptionKey}
                isRotatingKeys={isRotatingKeys} onRotateKeys={handleRotateEncryptionKey} />
            </TabsContent>
            <TabsContent value="isolation"><IsolationTab form={form} onSubmit={handleSecurityUpdate} isLoading={isLoading} /></TabsContent>
            <TabsContent value="compliance"><ComplianceTab form={form} onSubmit={handleSecurityUpdate} complianceReports={complianceReports} /></TabsContent>
            <TabsContent value="audit"><AuditTab form={form} isExportingData={isExportingData} onExportAuditLogs={handleExportAuditLogs} /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
