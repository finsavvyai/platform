// @ts-nocheck
/**
 * Policy Deployment Panel Component
 *
 * Enterprise-grade policy deployment workflow with approval process,
 * blue-green deployments, canary releases, and rollback capabilities
 */

'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Rocket, GitBranch, BarChart3, History } from 'lucide-react';

import { PolicyDeploymentPanelProps } from './types';
import { useDeployment } from './use-deployment';
import { DeploymentHeader } from './deployment-header';
import { DeployConfigTab } from './deploy-config-tab';
import { StagesTab } from './stages-tab';
import { MetricsTab } from './metrics-tab';
import { HistoryTab } from './history-tab';
import { DeploymentLogs } from './deployment-logs';
import { ApprovalDialog } from './approval-dialog';
import { RollbackDialog } from './rollback-dialog';

export default function PolicyDeploymentPanel({
  policy,
  deployments = [],
  environments = ['development', 'testing', 'staging', 'production'],
  onDeploy,
  onRollback,
  onApproval
}: PolicyDeploymentPanelProps) {
  const [activeTab, setActiveTab] = useState('deploy');
  const dep = useDeployment({ policy, deployments, onDeploy, onRollback, onApproval });

  return (
    <div className="h-full flex flex-col">
      <DeploymentHeader
        policy={policy}
        environments={environments}
        selectedEnvironment={dep.selectedEnvironment}
        currentDeployment={dep.currentDeployment}
        isDeploying={dep.isDeploying}
        onEnvironmentChange={dep.setSelectedEnvironment}
        onRollback={() => dep.setShowRollbackDialog(true)}
        onDeploy={dep.handleDeploy}
      />

      <div className="flex-1 flex">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="w-80 border-r bg-gray-50">
            <TabsList className="grid w-full grid-cols-4 m-2">
              <TabsTrigger value="deploy" className="text-xs">
                <Rocket className="h-3 w-3 mr-1" />Deploy
              </TabsTrigger>
              <TabsTrigger value="stages" className="text-xs">
                <GitBranch className="h-3 w-3 mr-1" />Stages
              </TabsTrigger>
              <TabsTrigger value="metrics" className="text-xs">
                <BarChart3 className="h-3 w-3 mr-1" />Metrics
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs">
                <History className="h-3 w-3 mr-1" />History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="deploy" className="p-4">
              <DeployConfigTab
                selectedEnvironment={dep.selectedEnvironment}
                deploymentConfig={dep.deploymentConfig}
                currentDeployment={dep.currentDeployment}
                policyId={policy.id}
                onConfigChange={dep.setDeploymentConfig}
              />
            </TabsContent>

            <TabsContent value="stages" className="p-4">
              <StagesTab stages={dep.deploymentStages} />
            </TabsContent>

            <TabsContent value="metrics" className="p-4">
              <MetricsTab metrics={dep.metrics} />
            </TabsContent>

            <TabsContent value="history" className="p-4">
              <HistoryTab deployments={deployments} />
            </TabsContent>
          </div>

          <div className="flex-1 flex flex-col">
            <DeploymentLogs
              logs={dep.deploymentLogs}
              onClear={() => dep.setDeploymentLogs([])}
            />
          </div>
        </Tabs>
      </div>

      {dep.showApprovalDialog && (
        <ApprovalDialog
          environment={dep.selectedEnvironment}
          approvers={dep.approvers}
          selectedApprovers={dep.selectedApprovers}
          approvalComment={dep.approvalComment}
          onApproversChange={dep.setSelectedApprovers}
          onCommentChange={dep.setApprovalComment}
          onSubmit={dep.handleSubmitApproval}
          onCancel={() => dep.setShowApprovalDialog(false)}
        />
      )}

      {dep.showRollbackDialog && (
        <RollbackDialog
          rollbackReason={dep.rollbackReason}
          onReasonChange={dep.setRollbackReason}
          onConfirm={dep.handleRollback}
          onCancel={() => dep.setShowRollbackDialog(false)}
        />
      )}
    </div>
  );
}
