// @ts-nocheck
/**
 * Execution logs panel for the Policy Test Panel
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal, Copy } from 'lucide-react';
import { TestExecution } from './types';

interface ExecutionLogsProps {
  execution: TestExecution;
  logContainerRef: React.RefObject<HTMLDivElement>;
  onClearLogs: () => void;
}

export function ExecutionLogs({ execution, logContainerRef, onClearLogs }: ExecutionLogsProps) {
  return (
    <div className="border-t bg-gray-900 text-gray-100">
      <div className="flex items-center justify-between p-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4" />
          <span className="text-sm font-semibold">Execution Logs</span>
          <Badge variant="secondary" className="text-xs">
            {execution.logs.length} entries
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onClearLogs}
            className="text-gray-400 hover:text-gray-200"
          >
            Clear
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              navigator.clipboard.writeText(
                execution.logs.map(l =>
                  `[${l.timestamp.toISOString()}] ${l.level.toUpperCase()}: ${l.message}`
                ).join('\n')
              );
            }}
            className="text-gray-400 hover:text-gray-200"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <ScrollArea ref={logContainerRef} className="h-32 px-4 pb-2">
        <div className="space-y-1 font-mono text-xs">
          {execution.logs.map((log, index) => (
            <div
              key={index}
              className={
                log.level === 'error' ? 'text-red-400' :
                log.level === 'warn' ? 'text-yellow-400' :
                log.level === 'info' ? 'text-blue-400' :
                'text-gray-500'
              }
            >
              <span className="text-gray-600">
                [{log.timestamp.toLocaleTimeString()}]
              </span>
              {' '}
              <span className="uppercase">{log.level}:</span>
              {' '}
              {log.message}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
