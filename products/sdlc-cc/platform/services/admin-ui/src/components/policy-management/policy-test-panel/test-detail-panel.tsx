// @ts-nocheck
/**
 * Test detail panel showing input/output/error for a selected test
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Code, XCircle, TestTube } from 'lucide-react';
import { TestCase } from './types';

interface TestDetailPanelProps {
  selectedTest: TestCase | null;
  showJsonEditor: boolean;
  onToggleJsonEditor: () => void;
  onUpdateTestCase: (id: string, updates: Partial<TestCase>) => void;
}

export function TestDetailPanel({
  selectedTest,
  showJsonEditor,
  onToggleJsonEditor,
  onUpdateTestCase
}: TestDetailPanelProps) {
  if (!selectedTest) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <TestTube className="h-12 w-12 mx-auto mb-2 text-gray-400" />
          <p className="text-muted-foreground">Select a test case to view details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{selectedTest.name}</h3>
            <p className="text-sm text-muted-foreground">{selectedTest.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                selectedTest.status === 'passed' ? 'default' :
                selectedTest.status === 'failed' ? 'destructive' :
                selectedTest.status === 'running' ? 'secondary' : 'outline'
              }
            >
              {selectedTest.status === 'idle' && 'Ready'}
              {selectedTest.status === 'running' && 'Running'}
              {selectedTest.status === 'passed' && 'Passed'}
              {selectedTest.status === 'failed' && 'Failed'}
              {selectedTest.status === 'error' && 'Error'}
              {selectedTest.status === 'skipped' && 'Skipped'}
            </Badge>
            <Button size="sm" variant="outline" onClick={onToggleJsonEditor}>
              <Code className="h-4 w-4 mr-1" />
              {showJsonEditor ? 'Hide' : 'Show'} JSON
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        <div className="flex-1 p-4">
          <Tabs defaultValue="input">
            <TabsList>
              <TabsTrigger value="input">Input Data</TabsTrigger>
              <TabsTrigger value="expected">Expected Output</TabsTrigger>
              {selectedTest.output && <TabsTrigger value="actual">Actual Output</TabsTrigger>}
              {selectedTest.error && <TabsTrigger value="error">Error Details</TabsTrigger>}
            </TabsList>

            <TabsContent value="input" className="mt-4">
              {showJsonEditor ? (
                <Textarea
                  value={JSON.stringify(selectedTest.input, null, 2)}
                  onChange={(e) => {
                    try {
                      const json = JSON.parse(e.target.value);
                      onUpdateTestCase(selectedTest.id, { input: json });
                    } catch (error) { /* Invalid JSON */ }
                  }}
                  rows={20}
                  className="font-mono text-xs"
                />
              ) : (
                <div className="space-y-3">
                  {Object.entries(selectedTest.input).map(([key, value]) => (
                    <div key={key}>
                      <Label className="text-xs font-semibold uppercase">{key.replace(/_/g, ' ')}</Label>
                      <pre className="mt-1 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="expected" className="mt-4">
              {showJsonEditor ? (
                <Textarea
                  value={JSON.stringify(selectedTest.expectedOutput, null, 2)}
                  onChange={(e) => {
                    try {
                      const json = JSON.parse(e.target.value);
                      onUpdateTestCase(selectedTest.id, { expectedOutput: json });
                    } catch (error) { /* Invalid JSON */ }
                  }}
                  rows={20}
                  className="font-mono text-xs"
                />
              ) : (
                <pre className="p-3 bg-gray-100 rounded text-xs overflow-x-auto">
                  {JSON.stringify(selectedTest.expectedOutput, null, 2)}
                </pre>
              )}
            </TabsContent>

            {selectedTest.output && (
              <TabsContent value="actual" className="mt-4">
                <pre className="p-3 bg-gray-100 rounded text-xs overflow-x-auto">
                  {JSON.stringify(selectedTest.output, null, 2)}
                </pre>
              </TabsContent>
            )}

            {selectedTest.error && (
              <TabsContent value="error" className="mt-4">
                <Alert className="border-red-200 bg-red-50">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription className="text-red-800">
                    {selectedTest.error}
                  </AlertDescription>
                </Alert>
              </TabsContent>
            )}
          </Tabs>
        </div>

        {selectedTest.coverage && (
          <div className="w-80 border-l p-4 bg-gray-50">
            <h3 className="font-semibold mb-3">Test Metrics</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Duration:</span>
                <span>{selectedTest.duration}ms</span>
              </div>
              {selectedTest.coverage.lines && (
                <>
                  <div className="flex justify-between text-sm">
                    <span>Coverage:</span>
                    <span>{selectedTest.coverage.lines}%</span>
                  </div>
                  <div className="space-y-1">
                    {Object.entries(selectedTest.coverage).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="capitalize">{key}:</span>
                        <span>{typeof value === 'number' ? `${value}%` : value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
