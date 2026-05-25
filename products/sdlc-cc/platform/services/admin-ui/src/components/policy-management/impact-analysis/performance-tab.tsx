// @ts-nocheck
/**
 * Impact Analysis Performance Tab
 */

'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

import { ImpactMetric } from './types';
import { getSeverityColor } from './helpers';

interface PerformanceTabProps {
  impactMetrics: ImpactMetric[];
}

function getTrendIcon(trend: 'up' | 'down' | 'stable') {
  switch (trend) {
    case 'up': return <TrendingUp className="h-4 w-4" />;
    case 'down': return <TrendingDown className="h-4 w-4" />;
    case 'stable': return <Activity className="h-4 w-4" />;
  }
}

export function PerformanceTab({ impactMetrics }: PerformanceTabProps) {
  return (
    <div className="space-y-6">
      {/* Performance Charts */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Performance Impact</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {impactMetrics.map((metric, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">{metric.name}</span>
                  <div className={`flex items-center gap-1 text-${getSeverityColor(metric.severity)}`}>
                    {getTrendIcon(metric.trend)}
                    <span className="text-sm font-semibold">
                      {metric.change > 0 ? '+' : ''}{metric.changePercent}%
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current</span>
                    <span>{metric.current}{metric.unit}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Projected</span>
                    <span className="font-semibold">{metric.projected}{metric.unit}</span>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`absolute h-full transition-all duration-500 ${
                        metric.changePercent > 0 ? 'bg-red-500' : 'bg-green-500'
                      }`}
                      style={{
                        width: `${Math.min(Math.abs(metric.changePercent), 100)}%`,
                        left: metric.changePercent < 0 ? 'auto' : '0',
                        right: metric.changePercent < 0 ? '0' : 'auto'
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Resource Utilization */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Resource Utilization</h3>
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">CPU Usage</span>
                  <span className="text-sm">+10%</span>
                </div>
                <Progress value={40} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">From 30% to 40%</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Memory Usage</span>
                  <span className="text-sm">+128MB</span>
                </div>
                <Progress value={65} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">From 512MB to 640MB</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Response Time</span>
                  <span className="text-sm">+8ms</span>
                </div>
                <Progress value={58} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">From 50ms to 58ms</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Error Rate</span>
                  <span className="text-sm">+0.1%</span>
                </div>
                <Progress value={20} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">From 0.1% to 0.2%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
