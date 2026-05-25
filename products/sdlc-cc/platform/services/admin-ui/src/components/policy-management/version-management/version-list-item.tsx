// @ts-nocheck
/**
 * Version List Item
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  GitCommit,
  GitCompare,
  Eye,
  RotateCcw,
  User,
  Calendar,
  Clock,
  CheckCircle,
  Loader2,
} from 'lucide-react';

import { PolicyVersion } from '@/types/policy-management';
import { VersionMetrics } from './types';
import { getRiskLevelColor } from './helpers';

interface VersionListItemProps {
  version: PolicyVersion;
  isSelected: boolean;
  isCurrent: boolean;
  metrics: VersionMetrics | undefined;
  isRestoring: boolean;
  onSelect: () => void;
  onView: () => void;
  onCompare: () => void;
  onRestore: () => void;
}

function getVersionStatusBadge(isCurrent: boolean, version: PolicyVersion) {
  if (isCurrent) {
    return <Badge className="bg-green-100 text-green-800">Current</Badge>;
  }
  if (version.metadata.version.includes('-rc')) {
    return <Badge variant="secondary">Release Candidate</Badge>;
  }
  if (version.metadata.version.includes('-deprecated')) {
    return <Badge variant="destructive">Deprecated</Badge>;
  }
  return <Badge variant="outline">Previous</Badge>;
}

export function VersionListItem({
  version,
  isSelected,
  isCurrent,
  metrics,
  isRestoring,
  onSelect,
  onView,
  onCompare,
  onRestore,
}: VersionListItemProps) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'border-blue-500' : ''
      }`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2">
                <GitCommit className="h-4 w-4 text-gray-500" />
                <span className="font-semibold">Version {version.version}</span>
                {getVersionStatusBadge(isCurrent, version)}
              </div>
              <Badge className={getRiskLevelColor(version.metadata.risk.level)}>
                {version.metadata.risk.level} risk
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground mb-3">{version.changelog}</p>

            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>{version.createdBy.split('@')[0]}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{version.createdAt.toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{version.createdAt.toLocaleTimeString()}</span>
              </div>
              {version.approvedBy && (
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>Approved by {version.approvedBy.split('@')[0]}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onView(); }}>
              <Eye className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onCompare(); }}>
              <GitCompare className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); onRestore(); }}
              disabled={isRestoring || isCurrent}
            >
              {isRestoring && isSelected ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>

        {/* Version Metrics */}
        {metrics && (
          <div className="mt-4 pt-3 border-t">
            <div className="grid grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Deployments:</span>
                <span className="ml-1 font-medium">{metrics.deployments}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Success Rate:</span>
                <span className="ml-1 font-medium">{metrics.successRate.toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Avg Performance:</span>
                <span className="ml-1 font-medium">{metrics.avgPerformance.toFixed(0)}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Error Rate:</span>
                <span className="ml-1 font-medium">{(metrics.errorRate * 100).toFixed(2)}%</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
