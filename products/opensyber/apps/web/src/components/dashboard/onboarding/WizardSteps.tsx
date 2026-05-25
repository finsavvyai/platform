'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Server, Loader2, CheckCircle2 } from 'lucide-react';

const REGIONS = ['eu-central', 'us-east', 'us-west', 'ap-southeast'] as const;
const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 36; // 90 seconds ceiling

function SkipLink({ onSkip }: { onSkip: () => void }) {
  return (
    <button
      onClick={onSkip}
      className="text-xs text-neutral-500 hover:text-neutral-300 mt-4 transition-colors"
    >
      Skip this step
    </button>
  );
}

type DeployPhase = 'idle' | 'creating' | 'provisioning' | 'running' | 'error';

/**
 * Step 1 — Deploy the agent and WAIT until the VM is actually running.
 *
 * The previous version called `onNext()` the moment `POST /api/proxy/instances`
 * returned, which was immediately after the row was inserted in D1 — the
 * Hetzner VM was still booting and the gateway token hadn't been written to
 * KV yet. Users got advanced to the next step while staring at a half-broken
 * dashboard.
 *
 * Now we poll `GET /api/proxy/instances/:id` until `status === 'running'`
 * (up to 90 seconds), reporting the phase to the user. We only advance
 * once the instance is actually reachable — so by the time the Connect
 * step renders, the gateway token is guaranteed to resolve.
 */
export function StepDeploy({ onNext }: { onNext: () => void }) {
  const [name, setName] = useState('My Agent');
  const [region, setRegion] = useState<string>(REGIONS[0]);
  const [error, setError] = useState('');
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null);
  const [upgradeCta, setUpgradeCta] = useState<string>('Upgrade plan');
  const [phase, setPhase] = useState<DeployPhase>('idle');
  const pollCount = useRef(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => { cancelledRef.current = true; };
  }, []);

  const pollStatus = useCallback(async (id: string) => {
    if (cancelledRef.current) return;
    pollCount.current += 1;
    if (pollCount.current > MAX_POLLS) {
      setError('Provisioning is taking longer than expected. Refresh and continue.');
      setPhase('error');
      return;
    }
    try {
      const res = await fetch(`/api/proxy/instances/${id}`);
      if (res.ok) {
        const data = await res.json() as { instance?: { status: string } };
        if (data.instance?.status === 'running') {
          setPhase('running');
          // Hold the success state briefly so the user sees the transition
          // before we advance. Without this the phase flips from spinner
          // to next-step in one animation frame and feels jarring.
          setTimeout(() => { if (!cancelledRef.current) onNext(); }, 900);
          return;
        }
        if (data.instance?.status === 'error') {
          setError('Provisioning failed. Try again or contact support.');
          setPhase('error');
          return;
        }
      }
    } catch {
      // Keep polling on transient errors.
    }
    if (!cancelledRef.current) {
      setTimeout(() => pollStatus(id), POLL_INTERVAL_MS);
    }
  }, [onNext]);

  async function handleDeploy() {
    if (!name.trim()) { setError('Instance name is required.'); return; }

    setPhase('creating');
    setError('');
    setUpgradeUrl(null);
    pollCount.current = 0;
    try {
      const res = await fetch('/api/proxy/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), region }),
      });
      const data = await res.json().catch(() => ({})) as {
        instance?: { id: string; status?: string };
        message?: string;
        upgradeUrl?: string;
        cta?: string;
      };
      if (!res.ok || !data.instance?.id) {
        if (data.upgradeUrl) {
          setUpgradeUrl(data.upgradeUrl);
          if (data.cta) setUpgradeCta(data.cta);
        }
        throw new Error(data.message || `Deploy failed (${res.status})`);
      }
      // Already running? Great, short-circuit the poll.
      if (data.instance.status === 'running') {
        setPhase('running');
        setTimeout(() => { if (!cancelledRef.current) onNext(); }, 900);
        return;
      }
      setPhase('provisioning');
      setTimeout(() => pollStatus(data.instance!.id), POLL_INTERVAL_MS);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setPhase('error');
    }
  }

  const busy = phase === 'creating' || phase === 'provisioning';
  const done = phase === 'running';

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-info/10 text-info mb-4">
        {done
          ? <CheckCircle2 className="h-6 w-6 text-green-400" />
          : <Server className="h-6 w-6" />}
      </div>
      <h3 className="text-lg font-medium text-white">
        {done ? 'Agent Running' : 'Deploy Your First Agent'}
      </h3>
      <p className="text-sm text-neutral-400 mt-1 mb-6">
        {done
          ? 'Your agent is live. Let\'s connect your machine to it.'
          : 'Launch a secure AI agent container in seconds.'}
      </p>
      <div className="w-full max-w-sm space-y-4">
        <input
          type="text"
          value={name}
          disabled={busy || done}
          onChange={(e) => setName(e.target.value)}
          placeholder="Agent name"
          className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white placeholder:text-neutral-500 disabled:opacity-50 focus:outline-none focus:border-signal"
        />
        <select
          value={region}
          disabled={busy || done}
          onChange={(e) => setRegion(e.target.value)}
          className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white disabled:opacity-50 focus:outline-none focus:border-signal"
        >
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        {error && (
          <div className="space-y-2">
            <p className="text-xs text-red-400">{error}</p>
            {upgradeUrl && (
              <a
                href={upgradeUrl}
                className="inline-flex items-center gap-1.5 rounded-lg bg-signal px-4 py-2 text-xs font-semibold text-void hover:bg-signal/90 transition-colors"
              >
                {upgradeCta} &rarr;
              </a>
            )}
          </div>
        )}
        {phase === 'provisioning' && (
          <p className="text-xs text-neutral-400">
            Provisioning container… this usually takes 20–40 seconds.
          </p>
        )}
        <button
          onClick={handleDeploy}
          disabled={busy || done}
          className="w-full rounded-lg bg-info px-6 py-3 text-sm font-medium text-white hover:bg-info disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {phase === 'idle' && 'Deploy Agent'}
          {phase === 'creating' && 'Creating…'}
          {phase === 'provisioning' && 'Provisioning…'}
          {phase === 'running' && 'Running ✓'}
          {phase === 'error' && 'Try Again'}
        </button>
      </div>
      <SkipLink onSkip={onNext} />
    </div>
  );
}
