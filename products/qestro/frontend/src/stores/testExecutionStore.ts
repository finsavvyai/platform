import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';

export interface TestStatus {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'running' | 'pending' | 'skipped';
  duration?: number;
  error?: string;
  screenshot?: string;
}

export interface TestRun {
  id: string;
  suiteId: string;
  status: 'running' | 'passed' | 'failed' | 'cancelled';
  startedAt: string;
  endedAt?: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  tests: TestStatus[];
  config: RunConfig;
  logs: string[];
}

export interface RunConfig {
  parallel?: boolean;
  environment?: string;
  captureScreenshots?: boolean;
  retryFailedTests?: boolean;
  platform?: 'browser' | 'mobile' | 'api';
  timeout?: number;
}

export interface TestExecutionState {
  activeRuns: Map<string, TestRun>;
  runHistory: TestRun[];
  currentRunId: string | null;
  isExecuting: boolean;
  error: string | null;
  wsConnected: boolean;
  subscribedRunIds: Set<string>;

  // Actions
  startTestRun: (suiteId: string, config: RunConfig) => Promise<void>;
  cancelRun: (runId: string) => Promise<void>;
  fetchRunHistory: (projectId: string, filters?: Record<string, unknown>) => Promise<void>;
  fetchRunDetails: (runId: string) => Promise<void>;
  subscribeToRun: (runId: string) => void;
  unsubscribeFromRun: (runId: string) => void;
  triggerSelfHealing: (testId: string, runId: string) => Promise<void>;
  generateTests: (description: string, platform: string) => Promise<void>;
  fetchAnalytics: (query: Record<string, unknown>) => Promise<unknown>;
  updateTestStatus: (runId: string, testId: string, status: TestStatus) => void;
  clearError: () => void;
  setCurrentRun: (runId: string | null) => void;
}

export const useTestExecutionStore = create<TestExecutionState>()(
  persist(
    (set, get) => ({
      activeRuns: new Map(),
      runHistory: [],
      currentRunId: null,
      isExecuting: false,
      error: null,
      wsConnected: false,
      subscribedRunIds: new Set(),

      startTestRun: async (suiteId: string, config: RunConfig) => {
        set({ isExecuting: true, error: null });
        try {
          const response = await api.createAutomationRun({
            name: `Test Suite ${suiteId}`,
            projectId: suiteId,
            userId: 'current-user',
            testCases: [],
            config: {
              parallel: config.parallel ?? false,
              environment: config.environment ?? 'staging',
              captureScreenshots: config.captureScreenshots ?? true,
              retryFailedTests: config.retryFailedTests ?? false,
            },
            metadata: { platform: config.platform },
          });

          const res = response as Record<string, unknown>;
          if (res?.id) {
            const runId = res.id as string;
            const newRun: TestRun = {
              id: runId,
              suiteId,
              status: 'running',
              startedAt: new Date().toISOString(),
              totalTests: 0,
              passedTests: 0,
              failedTests: 0,
              tests: [],
              config,
              logs: [],
            };

            const activeRuns = new Map(get().activeRuns);
            activeRuns.set(runId, newRun);
            set({ activeRuns, currentRunId: runId });

            // Subscribe to live updates
            get().subscribeToRun(runId);

            // Start the run
            await api.startAutomationRun(runId);
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to start test run';
          set({ error: message });
        } finally {
          set({ isExecuting: false });
        }
      },

      cancelRun: async (runId: string) => {
        try {
          await api.cancelAutomationRun(runId);
          const activeRuns = new Map(get().activeRuns);
          const run = activeRuns.get(runId);
          if (run) {
            run.status = 'cancelled';
            activeRuns.set(runId, run);
            set({ activeRuns });
          }
          get().unsubscribeFromRun(runId);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to cancel run';
          set({ error: message });
        }
      },

      fetchRunHistory: async (projectId: string, filters?: Record<string, unknown>) => {
        try {
          const response = await api.getAutomationRuns({
            projectId,
            status: filters?.status as string,
          });

          const res = response as Record<string, unknown>;
          if (Array.isArray(res?.data) || Array.isArray(response)) {
            const runs = (Array.isArray(res.data) ? res.data : response) as TestRun[];
            set({ runHistory: runs });
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch run history';
          set({ error: message });
        }
      },

      fetchRunDetails: async (runId: string) => {
        try {
          const response = await api.getAutomationRun(runId) as Record<string, unknown>;
          const run = (response?.data || response) as TestRun | undefined;

          if (run) {
            const activeRuns = new Map(get().activeRuns);
            activeRuns.set(runId, run);
            set({ activeRuns, currentRunId: runId });
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch run details';
          set({ error: message });
        }
      },

      subscribeToRun: (runId: string) => {
        const subscribedRunIds = new Set(get().subscribedRunIds);
        subscribedRunIds.add(runId);
        set({ subscribedRunIds });

        if (!get().wsConnected) {
          try {
            api.connectWebSocket(
              (data: unknown) => {
                const message = data as Record<string, unknown>;

                if (message.type === 'test-update') {
                  const { runId: msgRunId, test } = message as {
                    runId: string;
                    test: TestStatus;
                  };
                  get().updateTestStatus(msgRunId, test.id, test);
                } else if (message.type === 'run-complete') {
                  const { runId: msgRunId, status } = message as {
                    runId: string;
                    status: string;
                  };
                  const activeRuns = new Map(get().activeRuns);
                  const run = activeRuns.get(msgRunId);
                  if (run) {
                    run.status = status as TestRun['status'];
                    run.endedAt = new Date().toISOString();
                    activeRuns.set(msgRunId, run);
                    set({ activeRuns });
                  }
                }
              },
              (error: Event) => {
                console.error('WebSocket error:', error);
                set({ wsConnected: false });
              }
            );
            set({ wsConnected: true });
          } catch (err) {
            console.error('Failed to connect WebSocket:', err);
          }
        }
      },

      unsubscribeFromRun: (runId: string) => {
        const subscribedRunIds = new Set(get().subscribedRunIds);
        subscribedRunIds.delete(runId);
        set({ subscribedRunIds });

        if (subscribedRunIds.size === 0) {
          api.disconnectWebSocket();
          set({ wsConnected: false });
        }
      },

      triggerSelfHealing: async (testId: string, runId: string) => {
        try {
          const response = await api.triggerAISelfHealing() as Record<string, unknown>;

          const activeRuns = new Map(get().activeRuns);
          const run = activeRuns.get(runId);
          if (run) {
            const test = run.tests.find((t) => t.id === testId);
            const suggestions = response?.suggestions as string[] | undefined;
            if (test && suggestions) {
              test.error = suggestions[0] || test.error;
              activeRuns.set(runId, run);
              set({ activeRuns });
            }
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Self-healing failed';
          set({ error: message });
        }
      },

      generateTests: async (description: string, platform: string) => {
        try {
          const response = await api.generateTest({
            description,
            framework: platform === 'web' ? 'playwright' : 'maestro',
            testType: platform,
          });

          if ((response as Record<string, unknown>)?.code) {
            // Test generation successful
            return;
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Test generation failed';
          set({ error: message });
        }
      },

      fetchAnalytics: async (_query: Record<string, unknown>) => {
        try {
          const response = await api.getDashboardStats();
          return response;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch analytics';
          set({ error: message });
          return null;
        }
      },

      updateTestStatus: (runId: string, testId: string, status: TestStatus) => {
        const activeRuns = new Map(get().activeRuns);
        const run = activeRuns.get(runId);

        if (run) {
          const testIndex = run.tests.findIndex((t) => t.id === testId);
          if (testIndex >= 0) {
            run.tests[testIndex] = status;
          } else {
            run.tests.push(status);
          }

          // Update counts
          run.passedTests = run.tests.filter((t) => t.status === 'passed').length;
          run.failedTests = run.tests.filter((t) => t.status === 'failed').length;
          run.totalTests = run.tests.length;

          activeRuns.set(runId, run);
          set({ activeRuns });
        }
      },

      clearError: () => set({ error: null }),

      setCurrentRun: (runId: string | null) => set({ currentRunId: runId }),
    }),
    {
      name: 'qestro-test-execution',
      partialize: (state) => ({
        runHistory: state.runHistory,
        currentRunId: state.currentRunId,
      }),
    }
  )
);

// Computed selectors
export const usePassRate = (runId: string) => {
  const run = useTestExecutionStore((state) => state.activeRuns.get(runId));
  if (!run || run.totalTests === 0) return 0;
  return Math.round((run.passedTests / run.totalTests) * 100);
};

export const useTotalDuration = (runId: string) => {
  const run = useTestExecutionStore((state) => state.activeRuns.get(runId));
  if (!run) return 0;
  const start = new Date(run.startedAt).getTime();
  const end = run.endedAt ? new Date(run.endedAt).getTime() : Date.now();
  return Math.round((end - start) / 1000);
};

export const useFailedTests = (runId: string) => {
  const run = useTestExecutionStore((state) => state.activeRuns.get(runId));
  return run?.tests.filter((t) => t.status === 'failed') || [];
};

export const useActiveTestCount = (runId: string) => {
  const run = useTestExecutionStore((state) => state.activeRuns.get(runId));
  return run?.tests.filter((t) => t.status === 'running').length || 0;
};
