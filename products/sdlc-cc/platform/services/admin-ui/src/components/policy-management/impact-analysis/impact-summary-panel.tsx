// @ts-nocheck
/**
 * Impact Summary Side Panel
 */

'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Server } from 'lucide-react';

import { PolicyImpact } from '@/types/policy-management';
import { PredictionModel } from './types';
import { getRiskLevelColor } from './helpers';

interface ImpactSummaryPanelProps {
  impact: PolicyImpact | null;
  predictionModels: PredictionModel[];
}

export function ImpactSummaryPanel({
  impact,
  predictionModels,
}: ImpactSummaryPanelProps) {
  return (
    <div className="w-80 border-r bg-gray-50 p-4 overflow-y-auto">
      <div className="space-y-4">
        {/* Overall Risk Assessment */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Risk Assessment</h3>
          <Card className={`border-2 ${
            impact?.riskLevel === 'critical' ? 'border-red-500' :
            impact?.riskLevel === 'high' ? 'border-orange-500' :
            impact?.riskLevel === 'medium' ? 'border-yellow-500' :
            'border-green-500'
          }`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Risk Level</span>
                <Badge className={getRiskLevelColor(impact?.riskLevel || 'medium')}>
                  {impact?.riskLevel?.toUpperCase() || 'MEDIUM'}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Changes Required:</span>
                  <span>{impact?.estimatedChanges || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Downtime Risk:</span>
                  <span className="capitalize">{impact?.downtimeRisk || 'minimal'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Rollback Complexity:</span>
                  <span className="capitalize">{impact?.rollbackComplexity || 'moderate'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* User Impact Summary */}
        <div>
          <h3 className="text-sm font-semibold mb-3">User Impact</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Affected Users</span>
              <span className="font-semibold">
                {impact?.userImpact.affectedUsers?.toLocaleString() || 0}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Impact Level</span>
              <Badge variant={impact?.userImpact.impactLevel === 'significant' ? 'destructive' : 'secondary'}>
                {impact?.userImpact.impactLevel || 'moderate'}
              </Badge>
            </div>

            {impact?.userImpact.trainingRequired && (
              <Alert className="border-blue-200 bg-blue-50">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-blue-800 text-xs">
                  User training required
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <Separator />

        {/* System Impact */}
        <div>
          <h3 className="text-sm font-semibold mb-3">System Impact</h3>
          <div className="space-y-2">
            {impact?.systemImpact.services.map((service, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <Server className="h-3 w-3 text-gray-500" />
                <span>{service}</span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Prediction Models */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Prediction Models</h3>
          <div className="space-y-2">
            {predictionModels.map((model, index) => (
              <div key={index} className="p-2 bg-white rounded border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">{model.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {model.accuracy}% accuracy
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Confidence</span>
                  <span>{model.confidence}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
