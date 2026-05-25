import { useState, useEffect, useRef } from 'react';
import { cn } from '../lib/utils';
import {
  Play, Clock, CheckCircle, XCircle,
  Terminal, Share2, Zap, Server, StopCircle, Copy, Loader2, Plus, FileText, CheckCircle2, Video
} from 'lucide-react';
import { api } from '../lib/api';
import { Card, Button, Badge } from '../components/atoms';
import { DataTable } from '../components/molecules/DataTable/DataTable';
import { motion, AnimatePresence } from 'framer-motion';
import { useProject } from '../contexts/ProjectContext';
import { useOnboarding } from '../contexts/OnboardingContext';
import { EmptyState } from '../components/EmptyState';
import NewTestRunModal from '../components/modals/NewTestRunModal';

interface TestRun {
  id: string;
  displayId?: string | null;
  name: string;
  status: 'Running' | 'Passed' | 'Failed' | 'Stopped' | 'queued' | 'running' | 'passed' | 'failed' | 'cancelled' | 'paused';
  progress: number;
  passed: number;
  failed: number;
  total: number;
  timestamp: string;
}

interface BackendRun {
  id: string;
  displayId?: string | null;
  display_id?: string | null;
  name: string;
  status: string;
  passedTests?: number;
  failedTests?: number;
  skippedTests?: number;
  totalTests?: number;
  startTime?: number;
  createdAt?: number;
}

// Helper to transform backend status to display status
const mapStatus = (status: string): 'Running' | 'Passed' | 'Failed' | 'Stopped' => {
  const statusMap: Record<string, 'Running' | 'Passed' | 'Failed' | 'Stopped'> = {
    queued: 'Running',
    running: 'Running',
    passed: 'Passed',
    failed: 'Failed',
    cancelled: 'Stopped',
    paused: 'Stopped'
  };
  return statusMap[status.toLowerCase()] || 'Running';
};

// Helper to format timestamp
const formatTimestamp = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 60000) return 'Now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return 'Yesterday';
};

const fallbackRuns: TestRun[] = [
  {
    id: 'RUN-1',
    name: 'Nightly Core Regression',
    status: 'Running',
    progress: 36,
    passed: 42,
    failed: 1,
    total: 120,
    timestamp: '10m ago',
  },
  {
    id: 'RUN-2',
    name: 'Checkout Flow Tests',
    status: 'Passed',
    progress: 100,
    passed: 35,
    failed: 0,
    total: 35,
    timestamp: 'Yesterday',
  },
];

const Runs = () => {
  const { currentProject } = useProject();
  const { markTaskComplete } = useOnboarding();

  // State
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(true);
  const [runsList, setRunsList] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewRunModalOpen, setIsNewRunModalOpen] = useState(false);
  const [watchRunId, setWatchRunId] = useState<string | null>(null);

  const logContainerRef = useRef<HTMLDivElement>(null);

  // Fetch runs from API
  useEffect(() => {
    const fetchRuns = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.getAutomationRuns(
          currentProject?.id ? { projectId: currentProject.id } : undefined
        );

        if (response.success && response.data) {
          const transformedRuns: TestRun[] = (response.data as BackendRun[]).map((run) => {
            const passedTests = run.passedTests ?? 0;
            const failedTests = run.failedTests ?? 0;
            const skippedTests = run.skippedTests ?? 0;
            const totalTests = run.totalTests ?? 0;
            const timestamp = run.startTime ?? run.createdAt ?? Date.now();

            return {
              id: run.id,
              displayId: run.displayId ?? run.display_id ?? null,
              name: run.name,
              status: mapStatus(run.status),
              progress: totalTests > 0
                ? Math.round(((passedTests + failedTests + skippedTests) / totalTests) * 100)
                : 0,
              passed: passedTests,
              failed: failedTests,
              total: totalTests,
              timestamp: formatTimestamp(timestamp)
            };
          });

          setRunsList(transformedRuns);

          // Set first run as active if available
          if (transformedRuns.length > 0 && !activeRunId) {
            setActiveRunId(transformedRuns[0].id);
            setIsRunning(transformedRuns[0].status === 'Running');
          }
        }
      } catch (err) {
        console.warn('Automation runs API unavailable, using fallback runs', err);
        setRunsList(fallbackRuns);
        setActiveRunId(fallbackRuns[0].id);
        setIsRunning(true);
        setError(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRuns();
  }, [currentProject?.id, activeRunId]);

  // Live Console Simulation
  useEffect(() => {
    if (activeRunId !== 'RUN-1' || !isRunning) return;

    const possibleLogs = [
      '[INFO] Locating element: .submit-btn',
      '[SUCCESS] Element found (2ms)',
      '[ACTION] Clicked button',
      '[NETWORK] POST /api/login 200 OK',
      '[ZERO] Synced user session state instantly',
      '[MCP] Analyzing DOM for accessibility issues...',
      '[MCP] No critical issues found.',
      '[INFO] Verifying page title',
      '[SUCCESS] Title matches "Dashboard"',
      '[INFO] Waiting for element: .toast-message',
      '[SUCCESS] Element visible (15ms)'
    ];

    const interval = setInterval(() => {
      const randomLog = possibleLogs[Math.floor(Math.random() * possibleLogs.length)];
      const timestamp = new Date().toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 3 });

      setLogs(prev => {
        const newLogs = [...prev, `[${timestamp}] ${randomLog}`];
        if (newLogs.length > 50) return newLogs.slice(-50);
        return newLogs;
      });
    }, 800);

    return () => clearInterval(interval);
  }, [activeRunId, isRunning]);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Button handlers
  const handleStopRun = () => {
    setIsRunning(false);
    setRunsList(prev => prev.map(run =>
      run.id === activeRunId
        ? { ...run, status: 'Stopped' as const }
        : run
    ));
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString([], { hour12: false })}] [SYSTEM] Test run stopped by user`]);
  };

  const handleShareStream = () => {
    const shareUrl = `${window.location.origin}/runs/${activeRunId}/live`;
    navigator.clipboard.writeText(shareUrl);

    // Mark onboarding task as complete — sharing a run is a team action.
    markTaskComplete('invite_teammate');

    alert(`Stream URL copied to clipboard:\n${shareUrl}`);
  };

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    alert('Logs copied to clipboard!');
  };

  // Handler for marking a run as complete
  const handleCompleteRun = () => {
    if (!activeRunId) return;

    // Update the run status to Passed
    setRunsList(prev => prev.map(run =>
      run.id === activeRunId
        ? { ...run, status: 'Passed' as const, progress: 100 }
        : run
    ));
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString([], { hour12: false })}] [SUCCESS] Test run completed successfully!`]);

    // Mark onboarding task as complete — a finished run satisfies the Day 1 goal.
    markTaskComplete('run_first_test');

    alert('Test run marked as complete!');
  };

  // Handler for generating a report
  const handleGenerateReport = () => {
    if (!activeRunId || !activeRun) return;

    // In a real app, this would trigger actual report generation
    console.log(`Generating report for run ${activeRunId}`);
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString([], { hour12: false })}] [SYSTEM] Generating test report...`]);

    // Simulate report generation
    setTimeout(() => {
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString([], { hour12: false })}] [SUCCESS] Report generated: ${activeRun.name}_report.pdf`]);
      markTaskComplete('review_analytics');
      alert(`Report generated for "${activeRun.name}"!`);
    }, 1000);
  };

  const getActiveRun = () => runsList.find(r => r.id === activeRunId);
  const activeRun = getActiveRun();

  // Show loading state
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-text-secondary">Loading test runs...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <XCircle className="h-12 w-12 text-red-500" />
          <p className="text-red-400">Failed to load test runs</p>
          <p className="text-text-muted text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Handle new run creation success
  const handleNewRunSuccess = (run: Record<string, unknown>) => {
    // Create a local run entry immediately so the UI updates
    const now = new Date();
    const newRun: TestRun = {
      id: (run.id as string) || `RUN-${Date.now()}`,
      displayId: (run.displayId as string | null | undefined) ?? (run.display_id as string | null | undefined) ?? null,
      name: (run.name as string) || 'New Test Run',
      status: 'Running' as const,
      progress: 0,
      passed: 0,
      failed: 0,
      total: 5,
      timestamp: now.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    // Add to runs list and set as active immediately
    setRunsList(prev => [newRun, ...prev]);
    setActiveRunId(newRun.id);
    setIsRunning(true);

    // Add a log entry
    setLogs(prev => [
      ...prev,
      `[${now.toLocaleTimeString([], { hour12: false })}] [SYSTEM] Test run "${newRun.name}" started`
    ]);

    // Try to refresh from API in the background
    const refreshRuns = async () => {
      try {
        const response = await api.getAutomationRuns(
          currentProject?.id ? { projectId: currentProject.id } : undefined
        );
        if (response.success && response.data && response.data.length > 0) {
          const transformedRuns: TestRun[] = (response.data as BackendRun[]).map((r) => {
            const passedTests = r.passedTests ?? 0;
            const failedTests = r.failedTests ?? 0;
            const skippedTests = r.skippedTests ?? 0;
            const totalTests = r.totalTests ?? 0;
            const timestamp = r.startTime ?? r.createdAt ?? Date.now();

            return {
              id: r.id,
              displayId: r.displayId ?? r.display_id ?? null,
              name: r.name,
              status: mapStatus(r.status),
              progress: totalTests > 0
                ? Math.round(((passedTests + failedTests + skippedTests) / totalTests) * 100)
                : 0,
              passed: passedTests,
              failed: failedTests,
              total: totalTests,
              timestamp: formatTimestamp(timestamp)
            };
          });
          setRunsList(transformedRuns);
        }
      } catch {
        // Silently ignore - we already have the local run
        console.log('Background refresh failed, using local run data');
      }
    };
    refreshRuns();
  };

  // Show empty state when no runs
  if (runsList.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Play}
          title="No Test Runs Yet"
          description="Execute your test plans and track results in real-time with AI-powered insights."
          actionLabel="Run First Test"
          onAction={() => setIsNewRunModalOpen(true)}
        />
        <NewTestRunModal
          isOpen={isNewRunModalOpen}
          onClose={() => setIsNewRunModalOpen(false)}
          onSuccess={handleNewRunSuccess}
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-100px)] p-6 gap-6 max-w-[1600px] mx-auto">
      {/* Left Panel: Run List */}
      <Card variant="glass" className="w-1/3 flex flex-col overflow-hidden" padding="none">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
          <h3 className="font-bold text-text-primary flex items-center gap-2">
            <Play size={18} className="text-primary" />
            TEST RUNS
          </h3>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Plus size={14} />}
              onClick={() => setIsNewRunModalOpen(true)}
            >
              New Run
            </Button>
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              Zero Sync Active
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <DataTable
            data={runsList as unknown as Record<string, unknown>[]}
            columns={[
              {
                key: 'name',
                header: 'Run Name',
                render: (run: Record<string, unknown>) => {
                  const display = (run.displayId as string | null | undefined) ?? (run.id as string);
                  return (
                    <div>
                      <div className={cn("font-semibold", activeRunId === run.id ? "text-text-primary" : "text-text-secondary")}>{run.name as string}</div>
                      <div
                        className="text-xs text-text-muted font-mono"
                        title={run.id as string}
                      >
                        {display}
                      </div>
                    </div>
                  );
                }
              },
              {
                key: 'status',
                header: 'Status',
                render: (run: Record<string, unknown>) => (
                  <Badge
                    variant={
                      run.status === 'Running' ? 'warning' :
                        run.status === 'Passed' ? 'success' :
                          run.status === 'Stopped' ? 'secondary' :
                            'error'
                    }
                    size="sm"
                  >
                    {run.status as string}
                  </Badge>
                )
              },
              {
                key: 'progress',
                header: 'Progress',
                render: (run: Record<string, unknown>) => (
                  <div className="flex flex-col gap-1 w-24">
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full", run.status === 'Failed' ? 'bg-red-500' : run.status === 'Stopped' ? 'bg-[var(--text-muted)]' : 'bg-green-500')}
                        style={{ width: `${run.progress}%` }}
                      />
                    </div>
                    <div className="flex gap-2 text-[10px]">
                      <span className="text-green-400 flex items-center gap-0.5"><CheckCircle size={8} /> {run.passed as number}</span>
                      <span className="text-red-400 flex items-center gap-0.5"><XCircle size={8} /> {run.failed as number}</span>
                    </div>
                  </div>
                )
              }
            ]}
            onRowClick={(run) => setActiveRunId((run as TestRun).id)}
            className="border-none bg-transparent"
          />
        </div>
      </Card>

      {/* Right Panel: Live Console */}
      <div className="w-2/3 flex flex-col gap-6">
        {/* Status Header */}
        <Card variant="holographic" className="flex items-center justify-between p-6">
          <div>
            <h2 className="text-2xl font-bold text-text-primary mb-1">{activeRun?.name || 'Select a Run'}</h2>
            <div className="flex gap-4 text-sm text-text-secondary">
              <span className="flex items-center gap-1"><Server size={14} /> Environment: <span className="text-text-primary">Staging</span></span>
              <span className="flex items-center gap-1"><Clock size={14} /> Duration: <span className="text-text-primary">14m 32s</span></span>
              <span className="flex items-center gap-1">
                Status:
                <span className={cn(
                  "font-medium",
                  activeRun?.status === 'Running' ? 'text-yellow-400' :
                    activeRun?.status === 'Passed' ? 'text-green-400' :
                      activeRun?.status === 'Stopped' ? 'text-text-secondary' :
                        'text-red-400'
                )}>
                  {activeRun?.status || 'Unknown'}
                </span>
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FileText size={16} />}
              onClick={handleGenerateReport}
              disabled={!activeRunId}
            >
              Generate Report
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<CheckCircle2 size={16} />}
              onClick={handleCompleteRun}
              disabled={!activeRunId || activeRun?.status === 'Passed'}
            >
              Complete Run
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Video size={16} />}
              onClick={() => activeRunId && setWatchRunId(activeRunId)}
              disabled={!activeRunId}
            >
              Watch Recording
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Share2 size={16} />}
              onClick={handleShareStream}
            >
              Share Stream
            </Button>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<StopCircle size={16} />}
              onClick={handleStopRun}
              disabled={!isRunning || activeRun?.status !== 'Running'}
            >
              Stop Run
            </Button>
          </div>
        </Card>

        {/* Console Window */}
        <Card variant="glass" className="flex-1 flex flex-col font-mono text-sm overflow-hidden border-primary/20 shadow-glass" padding="none">
          <div className="bg-black/40 border-b border-white/10 p-3 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Terminal size={16} className="text-primary" />
              <span className="text-text-secondary font-bold">LIVE EXECUTION LOG</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Copy size={14} />}
                onClick={handleCopyLogs}
                className="text-xs"
              >
                Copy Logs
              </Button>
              <span className={cn(
                "flex items-center gap-1.5 text-xs px-2 py-1 rounded",
                isRunning && activeRun?.status === 'Running'
                  ? "text-green-400 bg-green-900/20"
                  : "text-text-secondary bg-black/20"
              )}>
                <Zap size={12} fill="currentColor" />
                {isRunning && activeRun?.status === 'Running' ? 'LIVE (12ms)' : 'STOPPED'}
              </span>
            </div>
          </div>

          <div
            ref={logContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-1 bg-black/60 font-mono text-xs md:text-sm text-text-secondary scrollbar-hide"
          >
            <AnimatePresence initial={false}>
              {logs.map((log, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="border-b border-white/5 pb-1 last:border-0 hover:bg-white/5 px-2 rounded"
                >
                  {log.includes('[ERROR]') || log.includes('[SYSTEM]') ? <span className="text-red-400">{log}</span> :
                    log.includes('[SUCCESS]') ? <span className="text-green-400">{log}</span> :
                      log.includes('[ZERO]') ? <span className="text-orange-400 font-bold">{log}</span> :
                        log.includes('[MCP]') ? <span className="text-purple-400 font-bold">{log}</span> :
                          <span className="text-text-secondary">{log}</span>}
                </motion.div>
              ))}
            </AnimatePresence>
            {logs.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-text-muted">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
                <span>Waiting for data stream...</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* New Test Run Modal */}
      <NewTestRunModal
        isOpen={isNewRunModalOpen}
        onClose={() => setIsNewRunModalOpen(false)}
        onSuccess={handleNewRunSuccess}
      />

      {/* Recording playback modal — streams real video from
          /api/recordings/:runId. Auth via ?token= because <video>
          can't send custom headers. Gracefully handles 404 via
          the onError hook in the <video> element. */}
      {watchRunId && (() => {
        const apiBase = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL || '';
        const token = typeof window !== 'undefined'
          ? (localStorage.getItem('access_token') || localStorage.getItem('token') || '')
          : '';
        const src = `${apiBase}/api/recordings/${encodeURIComponent(watchRunId)}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
        return (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => setWatchRunId(null)}
          >
            <div
              className="w-full max-w-4xl bg-gray-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div className="flex items-center gap-2 text-sm text-text-primary font-semibold">
                  <Video size={16} className="text-primary" /> Run recording ·{' '}
                  <span title={watchRunId}>
                    {runsList.find((r) => r.id === watchRunId)?.displayId || watchRunId}
                  </span>
                </div>
                <button
                  onClick={() => setWatchRunId(null)}
                  aria-label="Close recording"
                  className="text-text-secondary hover:text-text-primary"
                >✕</button>
              </div>
              <div className="bg-black">
                <video
                  src={src}
                  controls
                  preload="metadata"
                  playsInline
                  className="w-full max-h-[70vh]"
                  onError={(e) => {
                    const target = e.currentTarget;
                    const parent = target.parentElement;
                    if (parent && !parent.querySelector('.recording-fallback')) {
                      const note = document.createElement('div');
                      note.className = 'recording-fallback text-sm text-gray-400 p-6 text-center';
                      note.textContent = 'No recording available for this run yet.';
                      parent.appendChild(note);
                    }
                  }}
                >
                  Your browser does not support embedded video playback.
                </video>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Runs;
