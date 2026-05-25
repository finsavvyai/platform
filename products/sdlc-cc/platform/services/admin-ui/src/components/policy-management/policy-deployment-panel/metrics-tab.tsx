// @ts-nocheck
/**
 * Deployment metrics tab
 */

'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';

interface MetricsTabProps {
  metrics: {
    requestRate: number;
    errorRate: number;
    responseTime: number;
    cpuUsage: number;
    memoryUsage: number;
  };
}

export function MetricsTab({ metrics }: MetricsTabProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-3">Performance Metrics</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Request Rate</span><span>{metrics.requestRate}/s</span>
            </div>
            <Progress value={metrics.requestRate * 2} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Error Rate</span>
              <span className={metrics.errorRate > 5 ? 'text-red-600' : 'text-green-600'}>{metrics.errorRate}%</span>
            </div>
            <Progress value={metrics.errorRate} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Response Time</span><span>{metrics.responseTime}ms</span>
            </div>
            <Progress value={(metrics.responseTime / 1000) * 100} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>CPU Usage</span><span>{metrics.cpuUsage}%</span>
            </div>
            <Progress value={metrics.cpuUsage} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Memory Usage</span><span>{metrics.memoryUsage}%</span>
            </div>
            <Progress value={metrics.memoryUsage} className="h-2" />
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-3">Health Status</h3>
        <div className="space-y-2">
          {[
            { name: 'Policy Endpoint', status: 'Healthy' },
            { name: 'OPA Connection', status: 'Connected' },
            { name: 'Cache Status', status: 'Active' }
          ].map(item => (
            <div key={item.name} className="flex items-center justify-between">
              <span className="text-sm">{item.name}</span>
              <Badge variant="default" className="bg-green-100 text-green-800">{item.status}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
