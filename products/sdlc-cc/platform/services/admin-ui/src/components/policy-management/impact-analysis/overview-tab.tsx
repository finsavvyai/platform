// @ts-nocheck
/**
 * Impact Analysis Overview Tab
 */

'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  CheckCircle,
  Info,
  Shield,
  Activity,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

import { ImpactMetric, SecurityImplication } from './types';
import { getRiskLevelColor, getSeverityColor } from './helpers';

interface OverviewTabProps {
  impactMetrics: ImpactMetric[];
  securityImplications: SecurityImplication[];
}

function getTrendIcon(trend: 'up' | 'down' | 'stable') {
  switch (trend) {
    case 'up': return <TrendingUp className="h-4 w-4" />;
    case 'down': return <TrendingDown className="h-4 w-4" />;
    case 'stable': return <Activity className="h-4 w-4" />;
  }
}

export function OverviewTab({ impactMetrics, securityImplications }: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Impact Metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Impact Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {impactMetrics.map((metric, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{metric.name}</span>
                  <div className={`flex items-center gap-1 text-${getSeverityColor(metric.severity)}`}>
                    {getTrendIcon(metric.trend)}
                    <span className="text-xs font-semibold">
                      {metric.change > 0 ? '+' : ''}{metric.changePercent}%
                    </span>
                  </div>
                </div>

                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold">{metric.projected}</span>
                  <span className="text-sm text-muted-foreground mb-1">{metric.unit}</span>
                </div>

                <div className="mt-2">
                  <Progress
                    value={Math.min(Math.abs(metric.changePercent), 100)}
                    className="h-1"
                  />
                </div>

                <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                  <span>Current: {metric.current}{metric.unit}</span>
                  <span>Projected: {metric.projected}{metric.unit}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Risk Breakdown */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Risk Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Security Risks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {securityImplications.slice(0, 3).map((impl, index) => (
                <div key={index} className="flex items-start gap-2">
                  <AlertTriangle className={`h-4 w-4 mt-0.5 text-${getSeverityColor(impl.severity)}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{impl.type}</p>
                    <p className="text-xs text-muted-foreground">{impl.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Operational Risks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Performance Impact</span>
                <Badge className={getRiskLevelColor('medium')}>Medium</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Downtime Risk</span>
                <Badge className={getRiskLevelColor('low')}>Low</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Rollback Complexity</span>
                <Badge className={getRiskLevelColor('medium')}>Moderate</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recommendations */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Recommendations</h3>
        <div className="space-y-2">
          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-blue-800">
              Deploy gradually with canary releases to monitor impact
            </AlertDescription>
          </Alert>
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-yellow-800">
              Monitor CPU usage closely after deployment
            </AlertDescription>
          </Alert>
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="text-green-800">
              Have rollback plan ready for quick recovery
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
