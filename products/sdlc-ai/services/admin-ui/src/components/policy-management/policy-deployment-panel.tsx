/**
 * Policy Deployment Panel Component
 *
 * Enterprise-grade policy deployment workflow with approval process,
  * blue-green deployments, canary releases, and rollback capabilities
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Upload,
  Download,
  Settings,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Shield,
  GitBranch,
  Users,
  Eye,
  EyeOff,
  Terminal,
  Activity,
  BarChart3,
  Zap,
  Database,
  RefreshCw,
  Loader2,
  ChevronRight,
  ChevronDown,
  GitMerge,
  GitCommit,
  Rocket,
  History,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  SkipForward,
  AlertCircle,
  Info,
  Lock,
  Unlock,
  Key,
  FileText,
  Copy,
  ExternalLink
} from 'lucide-react';

import {
  Policy,
  PolicyDeployment,
  DeploymentEnvironment,
  DeploymentStatus,
  PolicyApproval,
  ApprovalStatus,
  ApprovalType,
  DeployPolicyRequest,
  RollbackPolicyRequest,
  PolicyImpact,
  PolicyVersion
} from '@/types/policy-management';

interface PolicyDeploymentPanelProps {
  policy: Policy;
  deployments: PolicyDeployment[];
  environments: DeploymentEnvironment[];
  onDeploy?: (request: DeployPolicyRequest) => void;
  onRollback?: (request: RollbackPolicyRequest) => void;
  onApproval?: (approval: PolicyApproval) => void;
}

interface DeploymentStage {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  duration?: number;
  startTime?: Date;
  endTime?: Date;
  logs: string[];
  checks: HealthCheck[];
}

interface HealthCheck {
  name: string;
  status: 'pending' | 'passing' | 'failing';
  responseTime?: number;
  lastChecked?: Date;
  url?: string;
  details?: string;
}

interface Approver {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  decision?: 'approve' | 'reject' | 'pending';
  comment?: string;
  timestamp?: Date;
}

export default function PolicyDeploymentPanel({
  policy,
  deployments = [],
  environments = ['development', 'testing', 'staging', 'production'],
  onDeploy,
  onRollback,
  onApproval
}: PolicyDeploymentPanelProps) {
  const [activeTab, setActiveTab] = useState('deploy');
  const [selectedEnvironment, setSelectedEnvironment] = useState<DeploymentEnvironment>('staging');
  const [deploymentConfig, setDeploymentConfig] = useState({
    strategy: 'blue_green' as 'blue_green' | 'canary' | 'rolling' | 'immediate',
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
  });

  const [isDeploying, setIsDeploying] = useState(false);
  const [currentDeployment, setCurrentDeployment] = useState<PolicyDeployment | null>(null);
  const [deploymentStages, setDeploymentStages] = useState<DeploymentStage[]>([]);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');
  const [selectedApprovers, setSelectedApprovers] = useState<string[]>([]);
  const [rollbackReason, setRollbackReason] = useState('');
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [deploymentLogs, setDeploymentLogs] = useState<string[]>([]);
  const [metrics, setMetrics] = useState({
    requestRate: 0,
    errorRate: 0,
    responseTime: 0,
    cpuUsage: 0,
    memoryUsage: 0
  });

  // Mock approvers
  const [approvers] = useState<Approver[]>([
    {
      id: '1',
      name: 'John Doe',
      email: 'john.doe@example.com',
      role: 'Security Architect',
      decision: 'pending'
    },
    {
      id: '2',
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      role: 'Compliance Officer',
      decision: 'pending'
    },
    {
      id: '3',
      name: 'Mike Johnson',
      email: 'mike.johnson@example.com',
      role: 'Operations Manager',
      decision: 'pending'
    }
  ]);

  // Initialize deployment stages
  useEffect(() => {
    setDeploymentStages([
      {
        id: 'validation',
        name: 'Validation',
        status: 'pending',
        logs: [],
        checks: [
          { name: 'Syntax Check', status: 'pending' },
          { name: 'Security Scan', status: 'pending' },
          { name: 'Compliance Check', status: 'pending' }
        ]
      },
      {
        id: 'build',
        name: 'Build & Package',
        status: 'pending',
        logs: [],
        checks: [
          { name: 'Compile Policy', status: 'pending' },
          { name: 'Generate Bundle', status: 'pending' },
          { name: 'Sign Package', status: 'pending' }
        ]
      },
      {
        id: 'deploy',
        name: 'Deploy',
        status: 'pending',
        logs: [],
        checks: [
          { name: 'Upload to OPA', status: 'pending' },
          { name: 'Update Configuration', status: 'pending' },
          { name: 'Validate Deployment', status: 'pending' }
        ]
      },
      {
        id: 'verification',
        name: 'Verification',
        status: 'pending',
        logs: [],
        checks: [
          { name: 'Health Check', status: 'pending' },
          { name: 'Smoke Tests', status: 'pending' },
          { name: 'Performance Tests', status: 'pending' }
        ]
      }
    ]);
  }, [policy]);

  // Get deployment status badge
  const getStatusBadge = (status: DeploymentStatus) => {
    switch (status) {
      case 'not_deployed':
        return <Badge variant="secondary">Not Deployed</Badge>;
      case 'deploying':
        return <Badge variant="default"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Deploying</Badge>;
      case 'deployed':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Deployed</Badge>;
      case 'deployment_failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'rollback_in_progress':
        return <Badge variant="outline"><RotateCcw className="h-3 w-3 mr-1" />Rolling Back</Badge>;
      case 'rolled_back':
        return <Badge variant="outline"><RotateCcw className="h-3 w-3 mr-1" />Rolled Back</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Deploy policy
  const handleDeploy = useCallback(async () => {
    // Check if approval is required
    if (policy.securityContext.classification !== 'public' && selectedEnvironment === 'production') {
      setShowApprovalDialog(true);
      return;
    }

    await executeDeployment();
  }, [policy, selectedEnvironment]);

  // Execute deployment
  const executeDeployment = useCallback(async () => {
    setIsDeploying(true);

    // Create deployment record
    const deployment: PolicyDeployment = {
      id: `deploy-${Date.now()}`,
      policyId: policy.id,
      version: policy.version,
      environment: selectedEnvironment,
      status: 'deploying',
      requestedBy: 'current-user',
      deployedAt: new Date(),
      config: deploymentConfig,
      validation: {
        healthChecks: [
          {
            name: 'policy-endpoint',
            endpoint: `/v1/policies/${policy.id}/evaluate`,
            method: 'POST',
            expectedStatus: 200,
            timeout: 5000,
            retries: 3,
            interval: 1000
          }
        ],
        smokeTests: [
          {
            name: 'basic-auth',
            scenario: 'Test basic authentication flow',
            expected: { allow: true },
            timeout: 3000
          }
        ],
        performanceTests: [],
        securityTests: [],
        acceptanceTests: []
      },
      monitoring: {
        metrics: [
          {
            name: 'policy_evaluation_rate',
            query: 'rate(policy_evaluations_total[5m])',
            threshold: 100,
            comparison: 'lt',
            aggregation: 'avg',
            interval: 30
          }
        ],
        logs: [],
        alerts: [],
        dashboards: []
      }
    };

    setCurrentDeployment(deployment);

    // Simulate deployment stages
    const stages = [...deploymentStages];
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];

      // Update stage status
      stage.status = 'running';
      stage.startTime = new Date();
      setDeploymentStages([...stages]);

      // Add log
      const logEntry = `[${new Date().toLocaleTimeString()}] Starting stage: ${stage.name}`;
      setDeploymentLogs(prev => [...prev, logEntry]);

      // Simulate stage execution
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));

      // Update checks
      stage.checks.forEach(check => {
        check.status = Math.random() > 0.1 ? 'passing' : 'failing';
        check.responseTime = 100 + Math.random() * 500;
        check.lastChecked = new Date();
      });

      // Check if any check failed
      const hasFailures = stage.checks.some(c => c.status === 'failing');

      if (hasFailures && deploymentConfig.validationRequired) {
        stage.status = 'failed';
        stage.endTime = new Date();
        stage.duration = stage.endTime.getTime() - stage.startTime!.getTime();
        setDeploymentStages([...stages]);

        deployment.status = 'deployment_failed';
        setCurrentDeployment(deployment);
        setIsDeploying(false);

        setDeploymentLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] Stage ${stage.name} failed!`
        ]);

        return;
      }

      stage.status = 'completed';
      stage.endTime = new Date();
      stage.duration = stage.endTime.getTime() - stage.startTime!.getTime();
      setDeploymentStages([...stages]);

      setDeploymentLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Stage ${stage.name} completed successfully`
      ]);
    }

    // Deployment completed
    deployment.status = 'deployed';
    deployment.completedAt = new Date();
    setCurrentDeployment(deployment);
    setIsDeploying(false);

    setDeploymentLogs(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Deployment completed successfully!`
    ]);

    if (onDeploy) {
      onDeploy({
        policyId: policy.id,
        version: policy.version,
        environment: selectedEnvironment,
        config: deploymentConfig
      });
    }
  }, [policy, selectedEnvironment, deploymentConfig, deploymentStages, onDeploy]);

  // Submit for approval
  const handleSubmitApproval = useCallback(() => {
    if (!approvalComment.trim()) {
      alert('Please provide a comment for the approval request');
      return;
    }

    const approval: PolicyApproval = {
      id: `approval-${Date.now()}`,
      policyId: policy.id,
      version: policy.version,
      type: 'deployment',
      status: 'pending',
      requestedBy: 'current-user',
      requestedAt: new Date(),
      reviewers: selectedApprovers.map(id => ({
        id,
        name: approvers.find(a => a.id === id)?.name || '',
        email: approvers.find(a => a.id === id)?.email || '',
        role: approvers.find(a => a.id === id)?.role || '',
        required: true
      })),
      decisions: [],
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      conditions: [
        {
          type: 'security_review',
          description: 'Security review completed',
          required: true,
          met: false
        },
        {
          type: 'performance_test',
          description: 'Performance tests passing',
          required: true,
          met: false
        }
      ],
      comments: [
        {
          id: '1',
          authorId: 'current-user',
          authorName: 'Current User',
          content: approvalComment,
          timestamp: new Date(),
          type: 'comment',
          visibility: 'public'
        }
      ]
    };

    setShowApprovalDialog(false);
    setApprovalComment('');

    if (onApproval) {
      onApproval(approval);
    }

    // Simulate approval workflow
    setTimeout(() => {
      // Mock approval responses
      const mockApprovals = [
        {
          reviewerId: '1',
          decision: 'approve' as const,
          comment: 'Security review passed. Policy meets all requirements.',
          timestamp: new Date()
        },
        {
          reviewerId: '2',
          decision: 'approve' as const,
          comment: 'Compliance checks passed. Ready for deployment.',
          timestamp: new Date()
        }
      ];

      approval.decisions = mockApprovals;
      approval.status = 'approved';

      if (onApproval) {
        onApproval(approval);
      }

      // Auto-execute deployment after approval
      setTimeout(() => {
        executeDeployment();
      }, 1000);
    }, 3000);
  }, [policy, selectedApprovers, approvalComment, onApproval, executeDeployment]);

  // Rollback deployment
  const handleRollback = useCallback(async () => {
    if (!rollbackReason.trim()) {
      alert('Please provide a reason for the rollback');
      return;
    }

    const deployment = deployments.find(d => d.environment === selectedEnvironment);
    if (!deployment) {
      alert('No deployment found for rollback');
      return;
    }

    setShowRollbackDialog(false);

    if (onRollback) {
      onRollback({
        deploymentId: deployment.id,
        reason: rollbackReason,
        strategy: 'immediate'
      });
    }

    // Simulate rollback
    setCurrentDeployment({
      ...deployment,
      status: 'rollback_in_progress'
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    setCurrentDeployment({
      ...deployment,
      status: 'rolled_back'
    });

    setRollbackReason('');
    setDeploymentLogs(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Rollback completed: ${rollbackReason}`
    ]);
  }, [deployments, selectedEnvironment, rollbackReason, onRollback]);

  // Get environment color
  const getEnvironmentColor = (env: DeploymentEnvironment) => {
    switch (env) {
      case 'development': return 'bg-gray-100 text-gray-800';
      case 'testing': return 'bg-blue-100 text-blue-800';
      case 'staging': return 'bg-yellow-100 text-yellow-800';
      case 'production': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Policy Deployment</h2>
            <p className="text-sm text-muted-foreground">
              Deploy policy to environments with approval workflows
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Select value={selectedEnvironment} onValueChange={(value: DeploymentEnvironment) => setSelectedEnvironment(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {environments.map(env => (
                  <SelectItem key={env} value={env}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        env === 'production' ? 'bg-red-500' :
                        env === 'staging' ? 'bg-yellow-500' :
                        env === 'testing' ? 'bg-blue-500' :
                        'bg-gray-500'
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

            <Button
              size="sm"
              onClick={() => setShowRollbackDialog(true)}
              disabled={!currentDeployment || currentDeployment.status !== 'deployed'}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Rollback
            </Button>

            <Button
              size="sm"
              onClick={handleDeploy}
              disabled={isDeploying || (policy.status !== 'approved' && selectedEnvironment === 'production')}
            >
              {isDeploying ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4 mr-1" />
              )}
              Deploy
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="w-80 border-r bg-gray-50">
            <TabsList className="grid w-full grid-cols-4 m-2">
              <TabsTrigger value="deploy" className="text-xs">
                <Rocket className="h-3 w-3 mr-1" />
                Deploy
              </TabsTrigger>
              <TabsTrigger value="stages" className="text-xs">
                <GitBranch className="h-3 w-3 mr-1" />
                Stages
              </TabsTrigger>
              <TabsTrigger value="metrics" className="text-xs">
                <BarChart3 className="h-3 w-3 mr-1" />
                Metrics
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs">
                <History className="h-3 w-3 mr-1" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="deploy" className="p-4">
              <div className="space-y-4">
                <div>
                  <Label>Deployment Strategy</Label>
                  <Select value={deploymentConfig.strategy} onValueChange={(value: any) =>
                    setDeploymentConfig({ ...deploymentConfig, strategy: value })
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                    <input
                      type="range"
                      min="5"
                      max="50"
                      step="5"
                      value={deploymentConfig.canaryPercentage}
                      onChange={(e) => setDeploymentConfig({
                        ...deploymentConfig,
                        canaryPercentage: parseInt(e.target.value)
                      })}
                      className="w-full mt-1"
                    />
                  </div>
                )}

                <div>
                  <Label>Rollout Duration: {deploymentConfig.rolloutDuration} min</Label>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    step="5"
                    value={deploymentConfig.rolloutDuration}
                    onChange={(e) => setDeploymentConfig({
                      ...deploymentConfig,
                      rolloutDuration: parseInt(e.target.value)
                    })}
                    className="w-full mt-1"
                  />
                </div>

                <Separator />

                <div>
                  <Label>Deployment Options</Label>
                  <div className="space-y-2 mt-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={deploymentConfig.validationRequired}
                        onChange={(e) => setDeploymentConfig({
                          ...deploymentConfig,
                          validationRequired: e.target.checked
                        })}
                      />
                      <span className="text-sm">Require validation</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={deploymentConfig.autoRollback}
                        onChange={(e) => setDeploymentConfig({
                          ...deploymentConfig,
                          autoRollback: e.target.checked
                        })}
                      />
                      <span className="text-sm">Auto rollback on failure</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={deploymentConfig.notifications.email}
                        onChange={(e) => setDeploymentConfig({
                          ...deploymentConfig,
                          notifications: {
                            ...deploymentConfig.notifications,
                            email: e.target.checked
                          }
                        })}
                      />
                      <span className="text-sm">Email notifications</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={deploymentConfig.notifications.slack}
                        onChange={(e) => setDeploymentConfig({
                          ...deploymentConfig,
                          notifications: {
                            ...deploymentConfig.notifications,
                            slack: e.target.checked
                          }
                        })}
                      />
                      <span className="text-sm">Slack notifications</span>
                    </label>
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`/policies/${policy.id}/environments/${selectedEnvironment}`, '_blank')}
                            className="w-full mt-2"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View in {selectedEnvironment}
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
            </TabsContent>

            <TabsContent value="stages" className="p-4">
              <ScrollArea className="h-[calc(100vh-300px)]">
                <div className="space-y-3">
                  {deploymentStages.map((stage, index) => (
                    <Card key={stage.id} className={
                      stage.status === 'running' ? 'border-blue-500' :
                      stage.status === 'completed' ? 'border-green-500' :
                      stage.status === 'failed' ? 'border-red-500' :
                      'border-gray-200'
                    }>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {stage.status === 'pending' && <Clock className="h-4 w-4 text-gray-400" />}
                            {stage.status === 'running' && <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />}
                            {stage.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                            {stage.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}

                            <span className="text-sm font-medium">{stage.name}</span>
                          </div>

                          {stage.duration && (
                            <span className="text-xs text-muted-foreground">
                              {stage.duration}ms
                            </span>
                          )}
                        </div>

                        <div className="space-y-1">
                          {stage.checks.map((check, checkIndex) => (
                            <div key={checkIndex} className="flex items-center gap-2 text-xs">
                              {check.status === 'pending' && <Clock className="h-3 w-3 text-gray-400" />}
                              {check.status === 'passing' && <CheckCircle className="h-3 w-3 text-green-500" />}
                              {check.status === 'failing' && <XCircle className="h-3 w-3 text-red-500" />}

                              <span className={check.status === 'failing' ? 'text-red-600' : 'text-muted-foreground'}>
                                {check.name}
                              </span>

                              {check.responseTime && (
                                <span className="text-muted-foreground">
                                  ({check.responseTime}ms)
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="metrics" className="p-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-3">Performance Metrics</h3>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Request Rate</span>
                        <span>{metrics.requestRate}/s</span>
                      </div>
                      <Progress value={metrics.requestRate * 2} className="h-2" />
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Error Rate</span>
                        <span className={metrics.errorRate > 5 ? 'text-red-600' : 'text-green-600'}>
                          {metrics.errorRate}%
                        </span>
                      </div>
                      <Progress value={metrics.errorRate} className="h-2" />
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Response Time</span>
                        <span>{metrics.responseTime}ms</span>
                      </div>
                      <Progress value={(metrics.responseTime / 1000) * 100} className="h-2" />
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>CPU Usage</span>
                        <span>{metrics.cpuUsage}%</span>
                      </div>
                      <Progress value={metrics.cpuUsage} className="h-2" />
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Memory Usage</span>
                        <span>{metrics.memoryUsage}%</span>
                      </div>
                      <Progress value={metrics.memoryUsage} className="h-2" />
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-semibold mb-3">Health Status</h3>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Policy Endpoint</span>
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Healthy
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm">OPA Connection</span>
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Connected
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm">Cache Status</span>
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Active
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="p-4">
              <ScrollArea className="h-[calc(100vh-300px)]">
                <div className="space-y-3">
                  {deployments.length === 0 ? (
                    <div className="text-center py-8">
                      <History className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-muted-foreground">No deployment history</p>
                    </div>
                  ) : (
                    deployments.map((deployment, index) => (
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
                            {deployment.requestedBy} • {deployment.environment}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>

          {/* Main Panel */}
          <div className="flex-1 flex flex-col">
            {/* Deployment Logs */}
            <div className="flex-1 p-4">
              <div className="h-full bg-gray-900 text-gray-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    Deployment Logs
                  </h3>

                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {deploymentLogs.length} entries
                    </Badge>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeploymentLogs([])}
                      className="text-gray-400 hover:text-gray-200"
                    >
                      Clear
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(deploymentLogs.join('\n'));
                      }}
                      className="text-gray-400 hover:text-gray-200"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-[calc(100%-40px)]">
                  <div className="font-mono text-xs space-y-1">
                    {deploymentLogs.length === 0 ? (
                      <div className="text-gray-500 text-center py-8">
                        No logs available. Deploy the policy to see logs.
                      </div>
                    ) : (
                      deploymentLogs.map((log, index) => (
                        <div key={index} className="text-gray-300">
                          {log}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        </Tabs>
      </div>

      {/* Approval Dialog */}
      {showApprovalDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-[600px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Deployment Approval Required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  This policy requires approval before deployment to {selectedEnvironment}.
                </AlertDescription>
              </Alert>

              <div>
                <Label>Approvers</Label>
                <div className="mt-2 space-y-2">
                  {approvers.map(approver => (
                    <label key={approver.id} className="flex items-center gap-3 p-2 border rounded cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedApprovers.includes(approver.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedApprovers([...selectedApprovers, approver.id]);
                          } else {
                            setSelectedApprovers(selectedApprovers.filter(a => a !== approver.id));
                          }
                        }}
                      />

                      <div className="flex-1">
                        <div className="font-medium text-sm">{approver.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {approver.role} • {approver.email}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="approval-comment">Comment</Label>
                <Textarea
                  id="approval-comment"
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  placeholder="Explain why this deployment is needed..."
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmitApproval} disabled={!approvalComment.trim() || selectedApprovers.length === 0}>
                  <ThumbsUp className="h-4 w-4 mr-1" />
                  Submit for Approval
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rollback Dialog */}
      {showRollbackDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-[500px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Confirm Rollback
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-red-800">
                  Rolling back will revert the policy to its previous version. This may affect active services.
                </AlertDescription>
              </Alert>

              <div>
                <Label htmlFor="rollback-reason">Reason for Rollback</Label>
                <Textarea
                  id="rollback-reason"
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  placeholder="Describe the issue that requires rollback..."
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowRollbackDialog(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleRollback} disabled={!rollbackReason.trim()}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Rollback
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
