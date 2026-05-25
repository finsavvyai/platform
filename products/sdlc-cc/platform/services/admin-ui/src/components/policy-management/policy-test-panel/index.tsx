// @ts-nocheck
/**
 * Policy Test Panel Component
 *
 * Enterprise-grade policy testing interface with simulation capabilities,
 * sandboxed execution, and comprehensive test reporting
 */

'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { List, BarChart3, Shield } from 'lucide-react';

import { PolicyTestPanelProps } from './types';
import { useTestExecution } from './use-test-execution';
import { TestHeader } from './test-header';
import { TestScenariosTab } from './test-scenarios-tab';
import { TestCoverageTab } from './test-coverage-tab';
import { TestSecurityTab } from './test-security-tab';
import { TestDetailPanel } from './test-detail-panel';
import { ExecutionLogs } from './execution-logs';

export default function PolicyTestPanel({
  policyId,
  version,
  testSuites = [],
  onTestRun,
  onTestSelect
}: PolicyTestPanelProps) {
  const [activeTab, setActiveTab] = useState('scenarios');
  const exec = useTestExecution({ policyId, onTestRun });

  return (
    <div className="h-full flex flex-col">
      <TestHeader
        execution={exec.execution}
        testCases={exec.testCases}
        testResultsCount={exec.testResults.length}
        isRunning={exec.isRunning}
        currentTestIndex={exec.currentTestIndex}
        onSelectAll={exec.selectAllTests}
        onDeselectAll={exec.deselectAllTests}
        onAddTest={exec.addTestCase}
        onImport={exec.importTests}
        onExport={exec.exportResults}
        onRunTests={exec.runTests}
        onStopTests={exec.stopTests}
      />

      <div className="flex-1 flex">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="w-80 border-r bg-gray-50">
            <TabsList className="grid w-full grid-cols-3 m-2">
              <TabsTrigger value="scenarios" className="text-xs">
                <List className="h-3 w-3 mr-1" />Scenarios
              </TabsTrigger>
              <TabsTrigger value="coverage" className="text-xs">
                <BarChart3 className="h-3 w-3 mr-1" />Coverage
              </TabsTrigger>
              <TabsTrigger value="security" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />Security
              </TabsTrigger>
            </TabsList>

            <TabsContent value="scenarios" className="p-2">
              <TestScenariosTab
                testCases={exec.testCases}
                selectedTests={exec.selectedTests}
                selectedTest={exec.selectedTest}
                isRunning={exec.isRunning}
                onSelectTest={exec.setSelectedTest}
                onToggleTestSelection={(id, checked) => {
                  if (checked) {
                    exec.setSelectedTests([...exec.selectedTests, id]);
                  } else {
                    exec.setSelectedTests(exec.selectedTests.filter(t => t !== id));
                  }
                }}
                onDeleteTest={exec.deleteTestCase}
              />
            </TabsContent>

            <TabsContent value="coverage" className="p-4">
              <TestCoverageTab metrics={exec.execution.metrics} />
            </TabsContent>

            <TabsContent value="security" className="p-4">
              <TestSecurityTab metrics={exec.execution.metrics} />
            </TabsContent>
          </div>

          <div className="flex-1 flex flex-col">
            <TestDetailPanel
              selectedTest={exec.selectedTest}
              showJsonEditor={exec.showJsonEditor}
              onToggleJsonEditor={() => exec.setShowJsonEditor(!exec.showJsonEditor)}
              onUpdateTestCase={exec.updateTestCase}
            />
          </div>
        </Tabs>
      </div>

      <ExecutionLogs
        execution={exec.execution}
        logContainerRef={exec.logContainerRef}
        onClearLogs={() => exec.setExecution({ ...exec.execution, logs: [] })}
      />
    </div>
  );
}
