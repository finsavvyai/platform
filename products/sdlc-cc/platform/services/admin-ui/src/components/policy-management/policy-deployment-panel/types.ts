// @ts-nocheck
/**
 * Types for the Policy Deployment Panel
 */

import {
  Policy,
  PolicyDeployment,
  DeploymentEnvironment,
  DeploymentStatus,
  PolicyApproval,
  DeployPolicyRequest,
  RollbackPolicyRequest
} from '@/types/policy-management';

export interface PolicyDeploymentPanelProps {
  policy: Policy;
  deployments: PolicyDeployment[];
  environments: DeploymentEnvironment[];
  onDeploy?: (request: DeployPolicyRequest) => void;
  onRollback?: (request: RollbackPolicyRequest) => void;
  onApproval?: (approval: PolicyApproval) => void;
}

export interface DeploymentStage {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  duration?: number;
  startTime?: Date;
  endTime?: Date;
  logs: string[];
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: 'pending' | 'passing' | 'failing';
  responseTime?: number;
  lastChecked?: Date;
  url?: string;
  details?: string;
}

export interface Approver {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  decision?: 'approve' | 'reject' | 'pending';
  comment?: string;
  timestamp?: Date;
}

export interface DeploymentConfig {
  strategy: 'blue_green' | 'canary' | 'rolling' | 'immediate';
  canaryPercentage: number;
  rolloutDuration: number;
  testTraffic: number;
  validationRequired: boolean;
  autoRollback: boolean;
  rollbackThreshold: number;
  notifications: {
    email: boolean;
    slack: boolean;
    webhook: boolean;
  };
}

export const DEFAULT_DEPLOYMENT_CONFIG: DeploymentConfig = {
  strategy: 'blue_green',
  canaryPercentage: 10,
  rolloutDuration: 30,
  testTraffic: 5,
  validationRequired: true,
  autoRollback: true,
  rollbackThreshold: 5,
  notifications: {
    email: true,
    slack: true,
    webhook: false
  }
};

export const DEFAULT_APPROVERS: Approver[] = [
  { id: '1', name: 'John Doe', email: 'john.doe@example.com', role: 'Security Architect', decision: 'pending' },
  { id: '2', name: 'Jane Smith', email: 'jane.smith@example.com', role: 'Compliance Officer', decision: 'pending' },
  { id: '3', name: 'Mike Johnson', email: 'mike.johnson@example.com', role: 'Operations Manager', decision: 'pending' }
];
