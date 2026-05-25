// @ts-nocheck
/**
 * Deployment stages tab
 */

'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { DeploymentStage } from './types';

interface StagesTabProps {
  stages: DeploymentStage[];
}

export function StagesTab({ stages }: StagesTabProps) {
  return (
    <ScrollArea className="h-[calc(100vh-300px)]">
      <div className="space-y-3">
        {stages.map((stage) => (
          <Card key={stage.id} className={
            stage.status === 'running' ? 'border-blue-500' :
            stage.status === 'completed' ? 'border-green-500' :
            stage.status === 'failed' ? 'border-red-500' : 'border-gray-200'
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
                  <span className="text-xs text-muted-foreground">{stage.duration}ms</span>
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
                      <span className="text-muted-foreground">({check.responseTime}ms)</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
