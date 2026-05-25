'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { ShieldCheck, ShieldAlert, Lock, Database } from 'lucide-react'

interface OverviewTabProps {
  securityScore: number
}

export function OverviewTab({ securityScore }: OverviewTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 rounded-lg border">
        <div>
          <h3 className="font-medium flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />Security Score
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Overall security posture assessment</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{securityScore}/100</div>
          <Progress value={securityScore} className="w-32 mt-1" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <h4 className="font-medium mb-3 flex items-center gap-2"><Lock className="h-4 w-4" />Encryption Status</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><span className="text-sm">Data at Rest</span><Badge variant="default">AES-256-GCM</Badge></div>
              <div className="flex items-center justify-between"><span className="text-sm">Data in Transit</span><Badge variant="default">TLS 1.3</Badge></div>
              <div className="flex items-center justify-between"><span className="text-sm">Key Management</span><Badge variant="default">HSM</Badge></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h4 className="font-medium mb-3 flex items-center gap-2"><Database className="h-4 w-4" />Isolation Status</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><span className="text-sm">Database</span><Badge variant="default">Isolated</Badge></div>
              <div className="flex items-center justify-between"><span className="text-sm">Storage</span><Badge variant="default">Isolated</Badge></div>
              <div className="flex items-center justify-between"><span className="text-sm">Network</span><Badge variant="default">Isolated</Badge></div>
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
    </div>
  )
}
