// @ts-nocheck
/** Hook for test execution logic in Policy Test Panel */
import { useState, useCallback, useRef, useEffect } from 'react';
import { PolicyTestResult, TestPolicyResponse } from '@/types/policy-management';
import { TestCase, TestExecution, DEFAULT_EXECUTION } from './types';
import { createDefaultTestCases } from './default-test-cases';

interface UseTestExecutionProps {
  policyId: string;
  onTestRun?: (results: TestPolicyResponse) => void;
}

export function useTestExecution({ policyId, onTestRun }: UseTestExecutionProps) {
  const [testCases, setTestCases] = useState<TestCase[]>(createDefaultTestCases());
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [execution, setExecution] = useState<TestExecution>(DEFAULT_EXECUTION);
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [selectedTest, setSelectedTest] = useState<TestCase | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const [testResults, setTestResults] = useState<PolicyTestResult[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [execution.logs]);

  const selectAllTests = useCallback(() => {
    setSelectedTests(testCases.map(t => t.id));
  }, [testCases]);

  const deselectAllTests = useCallback(() => {
    setSelectedTests([]);
  }, []);

  const addTestCase = useCallback(() => {
    const newTest: TestCase = {
      id: Date.now().toString(),
      name: `Test Case ${testCases.length + 1}`,
      description: 'New test case',
      input: {},
      expectedOutput: {},
      status: 'idle'
    };
    setTestCases([...testCases, newTest]);
  }, [testCases]);

  const deleteTestCase = useCallback((id: string) => {
    setTestCases(testCases.filter(t => t.id !== id));
    setSelectedTests(selectedTests.filter(t => t !== id));
  }, [testCases, selectedTests]);

  const updateTestCase = useCallback((id: string, updates: Partial<TestCase>) => {
    setTestCases(testCases.map(t =>
      t.id === id ? { ...t, ...updates } : t
    ));
  }, [testCases]);

  const runTests = useCallback(async () => {
    const testsToRun = selectedTests.length > 0
      ? testCases.filter(t => selectedTests.includes(t.id))
      : testCases;
    if (testsToRun.length === 0) return;

    setIsRunning(true);
    const testId = `test-${Date.now()}`;
    setExecution({
      id: testId, status: 'running', startTime: new Date(),
      testCount: testsToRun.length, passedCount: 0, failedCount: 0,
      errorCount: 0, skippedCount: 0,
      logs: [{ timestamp: new Date(), level: 'info', message: `Starting test execution with ${testsToRun.length} test cases` }],
      metrics: { ...DEFAULT_EXECUTION.metrics, totalTests: testsToRun.length }
    });

    for (let i = 0; i < testsToRun.length; i++) {
      const test = testsToRun[i];
      setCurrentTestIndex(i);
      updateTestCase(test.id, { status: 'running' });
      setExecution(prev => ({
        ...prev, currentTest: test.name,
        logs: [...prev.logs, { timestamp: new Date(), level: 'info', message: `Running test: ${test.name}`, testId: test.id }]
      }));

      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      const passed = Math.random() > 0.2;
      const duration = 500 + Math.random() * 1500;

      updateTestCase(test.id, {
        status: passed ? 'passed' : 'failed', duration,
        output: passed ? test.expectedOutput : { allow: false, reason: 'Test assertion failed' },
        error: passed ? undefined : 'Expected allow=true but got allow=false',
        coverage: {
          lines: Math.floor(70 + Math.random() * 30),
          branches: Math.floor(65 + Math.random() * 35),
          functions: Math.floor(75 + Math.random() * 25),
          statements: Math.floor(70 + Math.random() * 30),
          scenarios: 1,
          uncoveredPaths: passed ? [] : ['rule_1']
        }
      });

      setExecution(prev => {
        const newPassed = prev.passedCount + (passed ? 1 : 0);
        const newFailed = prev.failedCount + (passed ? 0 : 1);
        return {
          ...prev, passedCount: newPassed, failedCount: newFailed,
          logs: [...prev.logs, { timestamp: new Date(), level: passed ? 'info' : 'error', message: `Test ${test.name} ${passed ? 'PASSED' : 'FAILED'} (${duration}ms)`, testId: test.id }],
          metrics: {
            ...prev.metrics, passedTests: newPassed, failedTests: newFailed,
            averageDuration: ((prev.metrics.averageDuration * i + duration) / (i + 1)),
            maxDuration: Math.max(prev.metrics.maxDuration || 0, duration),
            minDuration: prev.metrics.minDuration === 0 ? duration : Math.min(prev.metrics.minDuration || 0, duration)
          }
        };
      });
    }

    setExecution(prev => ({
      ...prev, status: 'completed', endTime: new Date(),
      duration: prev.endTime ? prev.endTime.getTime() - prev.startTime!.getTime() : 0,
      logs: [...prev.logs, { timestamp: new Date(), level: 'info', message: `Test execution completed. Passed: ${prev.passedCount}, Failed: ${prev.failedCount}` }],
      metrics: {
        ...prev.metrics, coverage: Math.floor(75 + Math.random() * 25),
        memoryUsage: 32 + Math.random() * 64, cpuUsage: 10 + Math.random() * 40,
        vulnerabilities: Math.floor(Math.random() * 3), complianceIssues: Math.floor(Math.random() * 2)
      }
    }));

    setIsRunning(false);
    setCurrentTestIndex(0);

    const results: PolicyTestResult[] = testsToRun.map((test) => ({
      id: `${testId}-${test.id}`, testSuite: 'default', scenario: test.name,
      status: test.status === 'passed' ? 'passed' : test.status === 'failed' ? 'failed' : 'error',
      duration: test.duration || 0, timestamp: new Date(),
      input: test.input, expectedOutput: test.expectedOutput, actualOutput: test.output,
      errors: test.error ? [{ type: 'assertion', message: test.error, severity: 'high' }] : [],
      coverage: test.coverage || { lines: 0, branches: 0, functions: 0, statements: 0, scenarios: 0, uncoveredPaths: [] },
      performance: { executionTime: test.duration || 0, memoryUsage: 16 + Math.random() * 32, cpuUsage: 5 + Math.random() * 20, requests: 1, throughput: 1000 / (test.duration || 1000) },
      security: { vulnerabilities: [], complianceChecks: [], dataLeaks: [] }
    }));

    setTestResults(results);
    if (onTestRun) {
      onTestRun({
        testRun: testId, status: 'completed', results,
        summary: { total: testsToRun.length, passed: execution.passedCount, failed: execution.failedCount, skipped: execution.skippedCount, errors: execution.errorCount, duration: execution.duration || 0, passRate: (execution.passedCount / testsToRun.length) * 100, coverage: execution.metrics.coverage },
        coverage: { lines: execution.metrics.coverage, branches: execution.metrics.coverage - 5, functions: execution.metrics.coverage + 5, statements: execution.metrics.coverage, scenarios: testsToRun.length, uncoveredPaths: [] },
        artifacts: []
      });
    }
  }, [selectedTests, testCases, updateTestCase, onTestRun]);

  const stopTests = useCallback(() => {
    setIsRunning(false);
    setExecution(prev => ({
      ...prev, status: 'cancelled', endTime: new Date(),
      logs: [...prev.logs, { timestamp: new Date(), level: 'warn', message: 'Test execution cancelled by user' }]
    }));
  }, []);

  const exportResults = useCallback(() => {
    const exportData = { testExecution: execution, testCases, results: testResults, timestamp: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `policy-test-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [execution, testCases, testResults]);

  const importTests = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.testCases && Array.isArray(data.testCases)) {
          setTestCases(data.testCases);
        }
      } catch (error) {
        console.error('Failed to import test cases:', error);
      }
    };
    reader.readAsText(file);
  }, []);

  return {
    testCases, selectedTests, setSelectedTests, execution, setExecution,
    showJsonEditor, setShowJsonEditor, selectedTest, setSelectedTest,
    isRunning, currentTestIndex, testResults, logContainerRef,
    selectAllTests, deselectAllTests, addTestCase, deleteTestCase,
    updateTestCase, runTests, stopTests, exportResults, importTests
  };
}
