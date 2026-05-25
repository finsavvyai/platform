// @ts-nocheck
/**
 * Test scenarios tab for the Policy Test Panel
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Trash2
} from 'lucide-react';
import { TestCase } from './types';

interface TestScenariosTabProps {
  testCases: TestCase[];
  selectedTests: string[];
  selectedTest: TestCase | null;
  isRunning: boolean;
  onSelectTest: (test: TestCase) => void;
  onToggleTestSelection: (id: string, checked: boolean) => void;
  onDeleteTest: (id: string) => void;
}

export function TestScenariosTab({
  testCases,
  selectedTests,
  selectedTest,
  isRunning,
  onSelectTest,
  onToggleTestSelection,
  onDeleteTest
}: TestScenariosTabProps) {
  return (
    <ScrollArea className="h-[calc(100vh-250px)]">
      <div className="space-y-2">
        {testCases.map((test) => (
          <Card
            key={test.id}
            className={`cursor-pointer transition-colors ${
              selectedTest?.id === test.id ? 'border-blue-500' : ''
            } ${selectedTests.includes(test.id) ? 'bg-blue-50' : ''}`}
            onClick={() => onSelectTest(test)}
          >
            <CardContent className="p-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2 flex-1">
                  <input
                    type="checkbox"
                    checked={selectedTests.includes(test.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleTestSelection(test.id, e.target.checked);
                    }}
                    disabled={isRunning}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{test.name}</p>
                    <p className="text-xs text-muted-foreground">{test.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant={
                          test.status === 'passed' ? 'default' :
                          test.status === 'failed' ? 'destructive' :
                          test.status === 'running' ? 'secondary' :
                          test.status === 'error' ? 'destructive' : 'outline'
                        }
                        className="text-xs"
                      >
                        {test.status === 'idle' && 'Ready'}
                        {test.status === 'running' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        {test.status === 'running' && 'Running'}
                        {test.status === 'passed' && <CheckCircle className="h-3 w-3 mr-1" />}
                        {test.status === 'passed' && 'Passed'}
                        {test.status === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                        {test.status === 'failed' && 'Failed'}
                        {test.status === 'error' && 'Error'}
                        {test.status === 'skipped' && 'Skipped'}
                      </Badge>
                      {test.duration && (
                        <span className="text-xs text-muted-foreground">{test.duration}ms</span>
                      )}
                      {test.coverage && (
                        <Badge variant="outline" className="text-xs">
                          {test.coverage.lines}% coverage
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); onDeleteTest(test.id); }}
                  disabled={isRunning}
                  className="opacity-50 hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
