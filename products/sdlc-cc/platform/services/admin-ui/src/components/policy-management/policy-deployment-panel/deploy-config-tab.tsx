// @ts-nocheck
/**
 * Deployment configuration tab
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RotateCcw,
  ExternalLink
} from 'lucide-react';
import {
  PolicyDeployment,
  DeploymentEnvironment,
  DeploymentStatus
} from '@/types/policy-management';
import { DeploymentConfig } from './types';

interface DeployConfigTabProps {
  selectedEnvironment: DeploymentEnvironment;
  deploymentConfig: DeploymentConfig;
  currentDeployment: PolicyDeployment | null;
  policyId: string;
  onConfigChange: (config: DeploymentConfig) => void;
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

export function DeployConfigTab({
  selectedEnvironment, deploymentConfig, currentDeployment, policyId, onConfigChange
}: DeployConfigTabProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Deployment Strategy</Label>
        <Select value={deploymentConfig.strategy} onValueChange={(v: any) => onConfigChange({ ...deploymentConfig, strategy: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="blue_green">Blue-Green</SelectItem>
            <SelectItem value="canary">Canary</SelectItem>
            <SelectItem value="rolling">Rolling</SelectItem>
            <SelectItem value="immediate">Immediate</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {deploymentConfig.strategy === 'canary' && (
        <div>
          <Label>Canary Percentage: {deploymentConfig.canaryPercentage}%</Label>
          <input type="range" min="5" max="50" step="5" value={deploymentConfig.canaryPercentage}
            onChange={(e) => onConfigChange({ ...deploymentConfig, canaryPercentage: parseInt(e.target.value) })}
            className="w-full mt-1" />
        </div>
      )}

      <div>
        <Label>Rollout Duration: {deploymentConfig.rolloutDuration} min</Label>
        <input type="range" min="5" max="60" step="5" value={deploymentConfig.rolloutDuration}
          onChange={(e) => onConfigChange({ ...deploymentConfig, rolloutDuration: parseInt(e.target.value) })}
          className="w-full mt-1" />
      </div>

      <Separator />

      <div>
        <Label>Deployment Options</Label>
        <div className="space-y-2 mt-2">
          {[
            { key: 'validationRequired', label: 'Require validation' },
            { key: 'autoRollback', label: 'Auto rollback on failure' }
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2">
              <input type="checkbox" checked={deploymentConfig[key]}
                onChange={(e) => onConfigChange({ ...deploymentConfig, [key]: e.target.checked })} />
              <span className="text-sm">{label}</span>
            </label>
          ))}
          {[
            { key: 'email', label: 'Email notifications' },
            { key: 'slack', label: 'Slack notifications' }
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2">
              <input type="checkbox" checked={deploymentConfig.notifications[key]}
                onChange={(e) => onConfigChange({
                  ...deploymentConfig,
                  notifications: { ...deploymentConfig.notifications, [key]: e.target.checked }
                })} />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <Label>Current Status</Label>
        <div className="mt-2">
          {currentDeployment ? (
            <div className="space-y-2">
              {getStatusBadge(currentDeployment.status)}
              {currentDeployment.deployedAt && (
                <p className="text-xs text-muted-foreground">
                  Deployed: {currentDeployment.deployedAt.toLocaleString()}
                </p>
              )}
              {currentDeployment.completedAt && (
                <p className="text-xs text-muted-foreground">
                  Completed: {currentDeployment.completedAt.toLocaleString()}
                </p>
              )}
              {currentDeployment.status === 'deployed' && (
                <Button size="sm" variant="outline"
                  onClick={() => window.open(`/policies/${policyId}/environments/${selectedEnvironment}`, '_blank')}
                  className="w-full mt-2">
                  <ExternalLink className="h-3 w-3 mr-1" />View in {selectedEnvironment}
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-muted-foreground">Not deployed to {selectedEnvironment}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
