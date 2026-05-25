// @ts-nocheck
/**
 * Deployment header with environment selector and action buttons
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RotateCcw, Loader2, Rocket } from 'lucide-react';
import {
  Policy,
  PolicyDeployment,
  DeploymentEnvironment
} from '@/types/policy-management';

interface DeploymentHeaderProps {
  policy: Policy;
  environments: DeploymentEnvironment[];
  selectedEnvironment: DeploymentEnvironment;
  currentDeployment: PolicyDeployment | null;
  isDeploying: boolean;
  onEnvironmentChange: (env: DeploymentEnvironment) => void;
  onRollback: () => void;
  onDeploy: () => void;
}

export function getEnvironmentColor(env: DeploymentEnvironment) {
  switch (env) {
    case 'development': return 'bg-gray-100 text-gray-800';
    case 'testing': return 'bg-blue-100 text-blue-800';
    case 'staging': return 'bg-yellow-100 text-yellow-800';
    case 'production': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

export function DeploymentHeader({
  policy, environments, selectedEnvironment, currentDeployment,
  isDeploying, onEnvironmentChange, onRollback, onDeploy
}: DeploymentHeaderProps) {
  return (
    <div className="border-b bg-gray-50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Policy Deployment</h2>
          <p className="text-sm text-muted-foreground">
            Deploy policy to environments with approval workflows
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedEnvironment} onValueChange={(v: DeploymentEnvironment) => onEnvironmentChange(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {environments.map(env => (
                <SelectItem key={env} value={env}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      env === 'production' ? 'bg-red-500' :
                      env === 'staging' ? 'bg-yellow-500' :
                      env === 'testing' ? 'bg-blue-500' : 'bg-gray-500'
                    }`} />
                    {env}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge className={getEnvironmentColor(selectedEnvironment)}>
            {selectedEnvironment}
          </Badge>
          <Button size="sm" onClick={onRollback} disabled={!currentDeployment || currentDeployment.status !== 'deployed'}>
            <RotateCcw className="h-4 w-4 mr-1" />Rollback
          </Button>
          <Button size="sm" onClick={onDeploy} disabled={isDeploying || (policy.status !== 'approved' && selectedEnvironment === 'production')}>
            {isDeploying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Rocket className="h-4 w-4 mr-1" />}
            Deploy
          </Button>
        </div>
      </div>
    </div>
  );
}
