'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FlaskConical, MessageSquareWarning, Upload, Package,
  KeyRound, Wrench, Shield, Play,
} from 'lucide-react';
import type { TestSuite, TestRun, SuiteCategory } from './detection-types';
import { DetectionResultsTable } from './DetectionResultsTable';

const SUITE_ICON_MAP: Record<SuiteCategory, React.ElementType> = {
  'prompt-injection': MessageSquareWarning,
  'exfiltration': Upload,
  'supply-chain': Package,
  'credential-probe': KeyRound,
  'tool-anomaly': Wrench,
  'full': Shield,
};

export default function DetectionTestsPage() {
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<TestRun | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  const loadSuites = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/proxy/detection-tests/suites')
      .then((r) => r.json())
      .then((d: { data?: TestSuite[]; error?: string }) => {
        if (d.error) throw new Error(d.error);
        setSuites(d.data ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadSuites(); }, [loadSuites]);

  async function runSuite(suiteId: string) {
    setRunning(suiteId);
    setError(null);
    try {
      const res = await fetch('/api/proxy/detection-tests/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: 'default', suiteId }),
      });
      const body = await res.json();
      if (body.error) throw new Error(body.message ?? body.error);
      setRunResult(body.data as TestRun);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run suite');
    } finally {
      setRunning(null);
    }
  }

  if (runResult) {
    return (
      <div className="space-y-8">
        <Header />
        <DetectionResultsTable run={runResult} onBack={() => setRunResult(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Header />
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 text-red-400 p-3 text-sm">
          {error}
        </div>
      )}
      {loading ? (
        <div className="text-zinc-400 text-sm">Loading test suites...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suites.map((suite) => {
            const Icon = SUITE_ICON_MAP[suite.category] ?? Shield;
            return (
              <div
                key={suite.id}
                className="bg-gray-800/50 border border-gray-700 rounded-lg p-5 flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-signal" />
                  <h3 className="text-white font-semibold">{suite.name}</h3>
                </div>
                <p className="text-sm text-zinc-400 flex-1">{suite.description}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-zinc-500">{suite.testCount} tests</span>
                  <button
                    type="button"
                    disabled={running !== null}
                    onClick={() => runSuite(suite.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-signal text-zinc-950 text-xs font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    <Play className="h-3 w-3" />
                    {running === suite.id ? 'Running...' : 'Run Suite'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-3">
      <FlaskConical className="h-6 w-6 text-signal" />
      <div>
        <h1 className="text-3xl font-bold text-white">Detection Validation</h1>
        <p className="text-sm text-gray-400 mt-1">
          Run attack simulations against your agent to verify detections fire on demand.
        </p>
      </div>
    </div>
  );
}
