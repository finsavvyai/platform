'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle, Key, Shield, UserCheck, UserX } from 'lucide-react'
import type { User } from '@/types/user-management'
import type { SecurityMetrics } from './types'

interface SecurityOverviewTabProps {
  user: User
  securityMetrics: SecurityMetrics | null
}

export function SecurityOverviewTab({ user, securityMetrics }: SecurityOverviewTabProps) {
  return (
    <div className="space-y-4">
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
          <Badge variant={user.status === 'ACTIVE' ? 'default' : 'destructive'}>
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
    </div>
  )
}
