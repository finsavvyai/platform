// @ts-nocheck
/**
 * Deployment logs panel
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal, Copy } from 'lucide-react';

interface DeploymentLogsProps {
  logs: string[];
  onClear: () => void;
}

export function DeploymentLogs({ logs, onClear }: DeploymentLogsProps) {
  return (
    <div className="flex-1 p-4">
      <div className="h-full bg-gray-900 text-gray-100 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Deployment Logs
          </h3>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {logs.length} entries
            </Badge>
            <Button size="sm" variant="ghost" onClick={onClear}
              className="text-gray-400 hover:text-gray-200">
              Clear
            </Button>
            <Button size="sm" variant="ghost"
              onClick={() => navigator.clipboard.writeText(logs.join('\n'))}
              className="text-gray-400 hover:text-gray-200">
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <ScrollArea className="h-[calc(100%-40px)]">
          <div className="font-mono text-xs space-y-1">
            {logs.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                No logs available. Deploy the policy to see logs.
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="text-gray-300">{log}</div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
