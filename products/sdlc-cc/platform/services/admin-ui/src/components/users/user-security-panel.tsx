'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Shield } from 'lucide-react'
import type { User } from '@/types/user-management'
import { useSecurityActions } from './security/use-security-actions'
import { SecurityOverviewTab } from './security/security-overview-tab'
import { SecuritySettingsTab } from './security/security-settings-tab'
import { SecurityActivityTab } from './security/security-activity-tab'
import { SecurityActionsTab } from './security/security-actions-tab'

interface UserSecurityPanelProps {
  user: User
  onUpdate: (updates: Partial<User>) => void
}

export function UserSecurityPanel({ user, onUpdate }: UserSecurityPanelProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const {
    isLoading, securityEvents, securityMetrics,
    isResettingMFA, isSendingResetLink, isImpersonating,
    handleSecurityUpdate, handleResetMFA, handleSendPasswordReset, handleImpersonateUser,
  } = useSecurityActions(user, onUpdate)

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
            <TabsContent value="overview">
              <SecurityOverviewTab user={user} securityMetrics={securityMetrics} />
            </TabsContent>
            <TabsContent value="settings">
              <SecuritySettingsTab isLoading={isLoading} onSubmit={handleSecurityUpdate} />
            </TabsContent>
            <TabsContent value="activity">
              <SecurityActivityTab securityEvents={securityEvents} />
            </TabsContent>
            <TabsContent value="actions">
              <SecurityActionsTab
                user={user}
                isSendingResetLink={isSendingResetLink}
                isResettingMFA={isResettingMFA}
                isImpersonating={isImpersonating}
                onSendPasswordReset={handleSendPasswordReset}
                onResetMFA={handleResetMFA}
                onImpersonateUser={handleImpersonateUser}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
