// @ts-nocheck
/**
 * Deployment history tab
 */

'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  History,
  CheckCircle,
  XCircle,
  RotateCcw,
  Loader2
} from 'lucide-react';
import { PolicyDeployment, DeploymentStatus } from '@/types/policy-management';

interface HistoryTabProps {
  deployments: PolicyDeployment[];
}

function getStatusBadge(status: DeploymentStatus) {
  switch (status) {
    case 'not_deployed': return <Badge variant="secondary">Not Deployed</Badge>;
    case 'deploying': return <Badge variant="default"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Deploying</Badge>;
    case 'deployed': return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Deployed</Badge>;
    case 'deployment_failed': return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    case 'rollback_in_progress': return <Badge variant="outline"><RotateCcw className="h-3 w-3 mr-1" />Rolling Back</Badge>;
    case 'rolled_back': return <Badge variant="outline"><RotateCcw className="h-3 w-3 mr-1" />Rolled Back</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
  }
}

export function HistoryTab({ deployments }: HistoryTabProps) {
  return (
    <ScrollArea className="h-[calc(100vh-300px)]">
      <div className="space-y-3">
        {deployments.length === 0 ? (
          <div className="text-center py-8">
            <History className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-muted-foreground">No deployment history</p>
          </div>
        ) : (
          deployments.map((deployment) => (
            <Card key={deployment.id} className="cursor-pointer hover:shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(deployment.status)}
                    <span className="text-sm font-medium">v{deployment.version}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {deployment.deployedAt?.toLocaleDateString()}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {deployment.requestedBy} - {deployment.environment}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </ScrollArea>
  );
}
