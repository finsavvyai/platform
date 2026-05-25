// @ts-nocheck
/**
 * Test header with controls and progress bar
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Upload, Download, Play, Square, Loader2 } from 'lucide-react';
import { TestCase, TestExecution } from './types';

interface TestHeaderProps {
  execution: TestExecution;
  testCases: TestCase[];
  testResultsCount: number;
  isRunning: boolean;
  currentTestIndex: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onAddTest: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  onRunTests: () => void;
  onStopTests: () => void;
}

export function TestHeader({
  execution,
  testCases,
  testResultsCount,
  isRunning,
  currentTestIndex,
  onSelectAll,
  onDeselectAll,
  onAddTest,
  onImport,
  onExport,
  onRunTests,
  onStopTests
}: TestHeaderProps) {
  return (
    <div className="border-b bg-gray-50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Policy Testing</h2>
          <p className="text-sm text-muted-foreground">
            Test policy logic with various scenarios and edge cases
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={execution.status === 'running' ? 'default' : 'secondary'}>
            {execution.status === 'idle' && 'Ready'}
            {execution.status === 'running' && (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            )}
            {execution.status === 'running' && 'Running'}
            {execution.status === 'completed' && 'Completed'}
            {execution.status === 'failed' && 'Failed'}
            {execution.status === 'cancelled' && 'Cancelled'}
          </Badge>

          <Button size="sm" variant="outline" onClick={onSelectAll} disabled={isRunning}>
            Select All
          </Button>
          <Button size="sm" variant="outline" onClick={onDeselectAll} disabled={isRunning}>
            Deselect All
          </Button>
          <Button size="sm" onClick={onAddTest} disabled={isRunning}>
            <Plus className="h-4 w-4 mr-1" />Add Test
          </Button>
          <Button size="sm" variant="outline" onClick={() => document.getElementById('import-tests')?.click()} disabled={isRunning}>
            <Upload className="h-4 w-4 mr-1" />Import
          </Button>
          <input id="import-tests" type="file" accept=".json" onChange={onImport} className="hidden" />
          <Button size="sm" variant="outline" onClick={onExport} disabled={!testResultsCount}>
            <Download className="h-4 w-4 mr-1" />Export
          </Button>
          <Button size="sm" onClick={isRunning ? onStopTests : onRunTests} disabled={!testCases.length}>
            {isRunning ? (
              <><Square className="h-4 w-4 mr-1" />Stop</>
            ) : (
              <><Play className="h-4 w-4 mr-1" />Run Tests</>
            )}
          </Button>
        </div>
      </div>

      {isRunning && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span>Running {currentTestIndex + 1} of {testCases.length}</span>
            <span>{Math.round(((currentTestIndex + 1) / testCases.length) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentTestIndex + 1) / testCases.length) * 100}%` }}
            />
          </div>
          {execution.currentTest && (
            <p className="text-xs text-muted-foreground mt-1">
              Current: {execution.currentTest}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
