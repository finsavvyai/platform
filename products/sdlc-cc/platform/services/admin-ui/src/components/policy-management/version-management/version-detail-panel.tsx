// @ts-nocheck
/**
 * Version Detail Side Panel
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { XCircle } from 'lucide-react';

import { PolicyVersion } from '@/types/policy-management';
import { VersionMetrics } from './types';
import { getRiskLevelColor } from './helpers';

interface VersionDetailPanelProps {
  version: PolicyVersion;
  metrics: VersionMetrics | undefined;
  selectedTab: string;
  onTabChange: (tab: string) => void;
  onClose: () => void;
}

export function VersionDetailPanel({
  version,
  metrics,
  selectedTab,
  onTabChange,
  onClose,
}: VersionDetailPanelProps) {
  return (
    <div className="w-96 border-l bg-gray-50 overflow-y-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Version Details</h3>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <XCircle className="h-4 w-4" />
          </Button>
        </div>

        <Tabs value={selectedTab} onValueChange={onTabChange}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="code" className="text-xs">Code</TabsTrigger>
            <TabsTrigger value="metrics" className="text-xs">Metrics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Version</label>
              <p className="font-medium">{version.version}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Created By</label>
              <p className="text-sm">{version.createdBy}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Created At</label>
              <p className="text-sm">{version.createdAt.toLocaleString()}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Changelog</label>
              <p className="text-sm">{version.changelog}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Risk Level</label>
              <Badge className={getRiskLevelColor(version.metadata.risk.level)}>
                {version.metadata.risk.level.toUpperCase()}
              </Badge>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Risk Score</label>
              <p className="text-sm">{version.metadata.risk.score}/100</p>
            </div>

            <Separator />

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Compliance</label>
              <div className="space-y-1 mt-2">
                {version.metadata.compliance.frameworks.map((framework, index) => (
                  <Badge key={index} variant="outline" className="text-xs mr-1">
                    {framework}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Audit Score</label>
              <p className="text-sm">{version.metadata.compliance.auditScore}/100</p>
            </div>
          </TabsContent>

          <TabsContent value="code">
            <div className="mt-2">
              <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
                <code>{version.regoCode}</code>
              </pre>
            </div>
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4">
            {metrics && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Performance</label>
                  <div className="mt-1 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Max Execution Time</span>
                      <span>{version.metadata.performance.maxExecutionTime}ms</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Avg Execution Time</span>
                      <span>{version.metadata.performance.averageExecutionTime}ms</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Memory Usage</span>
                      <span>{version.metadata.performance.memoryUsage}MB</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>CPU Usage</span>
                      <span>{(version.metadata.performance.cpuUsage * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Deployment History</label>
                  <div className="mt-1 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Total Deployments</span>
                      <span>{metrics.deployments}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Rollbacks</span>
                      <span>{metrics.rollbacks}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Success Rate</span>
                      <span>{metrics.successRate.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                {metrics.lastDeployed && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Last Deployed</label>
                    <p className="text-sm">{metrics.lastDeployed.toLocaleString()}</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
