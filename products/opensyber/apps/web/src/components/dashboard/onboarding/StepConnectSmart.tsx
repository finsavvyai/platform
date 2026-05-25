'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Check, Copy, ChevronDown, Plug } from 'lucide-react';
import { ConnectAgentCard } from '../ConnectAgentCard';
import { detectOS, osLabel } from '@/lib/onboarding/os-detect';
import { snippetsForOS } from '@/lib/onboarding/install-snippets';

/**
 * Adaptive connect step.
 *
 * Differences from StepConnect:
 *  - Detects OS up-front and surfaces ONE install command tailored to it.
 *  - "Show all options" reveals the full ConnectAgentCard (CLI/MCP/VS Code/etc).
 *  - Auto-advances on the first heartbeat — no manual Continue button.
 *
 * Reuses the same data-loading shape as StepConnect (instance id + gateway
 * token + event poll) because the API contract is the same. When we wire
 * slice 7's orchestrator, the parent will pass instance + token via props
 * and these effects collapse to one-liners.
 */
export function StepConnectSmart({ onNext }: { onNext: () => void }) {
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [gatewayToken, setGatewayToken] = useState<string | null>(null);
  const [hasEvents, setHasEvents] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const os = useMemo(
    () => (typeof navigator !== 'undefined' ? detectOS(navigator.userAgent) : 'unknown'),
    [],
  );

  // Instance lookup with bounded retry — same race window as StepConnect.
  useEffect(() => {
    let cancelled = false;
    async function load(attempt = 0): Promise<void> {
      if (cancelled) return;
      try {
        const res = await fetch('/api/proxy/instances');
        if (res.ok) {
          const data = await res.json() as { instances?: Array<{ id: string }> };
          const id = data.instances?.[0]?.id;
          if (id) { setInstanceId(id); return; }
        }
      } catch { /* keep polling */ }
      if (attempt < 5 && !cancelled) setTimeout(() => load(attempt + 1), 2000);
      else if (!cancelled) setError('No agent instance found. Please deploy one first.');
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  // Gateway token lookup once we have an instance.
  useEffect(() => {
    if (!instanceId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/proxy/instances/${instanceId}/gateway-token`);
        if (res.ok) {
          const data = await res.json() as { data?: { gatewayToken?: string } };
          if (!cancelled) setGatewayToken(data.data?.gatewayToken ?? null);
        }
      } catch { /* surfaces via empty snippet token */ }
    })();
    return () => { cancelled = true; };
  }, [instanceId]);

  // Heartbeat poll — auto-advance on first event. The point of "less actions".
  useEffect(() => {
    if (!instanceId || hasEvents) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/proxy/security/instances/${instanceId}/dashboard`);
        if (res.ok) {
          const data = await res.json() as { dashboard?: { recentEvents?: unknown[] } };
          if ((data.dashboard?.recentEvents?.length ?? 0) > 0) {
            setHasEvents(true);
            setTimeout(onNext, 800);
            return;
          }
        }
      } catch { /* keep polling */ }
      if (!cancelled) setTimeout(poll, 3000);
    };
    void poll();
    return () => { cancelled = true; };
  }, [instanceId, hasEvents, onNext]);

  const snippets = useMemo(
    () => snippetsForOS(os, gatewayToken ?? '<your-token>'),
    [os, gatewayToken],
  );
  const primary = snippets[0];

  async function copyPrimary() {
    if (!primary) return;
    try {
      await navigator.clipboard.writeText(primary.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard may be unavailable */ }
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-red-400 mb-4">{error}</p>
        <button onClick={onNext} className="rounded-lg bg-info px-6 py-3 text-sm font-medium text-white">Continue anyway</button>
      </div>
    );
  }

  if (!instanceId) {
    return (
      <div className="flex flex-col items-center text-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400 mb-4" />
        <p className="text-sm text-neutral-400">Loading your agent…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-signal/10 text-signal mb-4">
        <Plug className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-medium text-white">Connect Your {osLabel(os)} Machine</h3>
      <p className="text-sm text-neutral-400 mt-1 mb-6 text-center max-w-md">
        One command. We&apos;ll auto-advance the moment your machine pings in.
      </p>

      {primary && (
        <div className="w-full max-w-xl">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs text-text-dim">{primary.label}</p>
            <button onClick={copyPrimary} className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition">
              {copied
                ? <><Check className="h-3 w-3 text-green-400" /> Copied</>
                : <><Copy className="h-3 w-3" /> Copy</>}
            </button>
          </div>
          <pre className="rounded-lg bg-surface/60 px-3 py-3 font-[family-name:var(--font-mono)] text-xs text-text-primary whitespace-pre overflow-x-auto">{primary.command}</pre>
          {primary.note && <p className="mt-2 text-[11px] text-neutral-500">{primary.note}</p>}
        </div>
      )}

      <div className="mt-6 flex items-center gap-2 text-xs text-text-secondary">
        {hasEvents
          ? <><span className="h-2.5 w-2.5 rounded-full bg-green-400" /> Connected — opening dashboard…</>
          : <><Loader2 className="h-3 w-3 animate-spin" /> Waiting for your first event…</>}
      </div>

      <button
        onClick={() => setShowAll((s) => !s)}
        className="mt-6 inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition"
        aria-expanded={showAll}
      >
        <ChevronDown className={`h-3 w-3 transition-transform ${showAll ? 'rotate-180' : ''}`} />
        {showAll ? 'Hide other tools' : 'Show MCP / VS Code / Cursor / Windsurf'}
      </button>

      {showAll && (
        <div className="mt-4 w-full">
          <ConnectAgentCard instanceId={instanceId} gatewayToken={gatewayToken} hasEvents={hasEvents} />
        </div>
      )}

      <button
        onClick={onNext}
        className="mt-6 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        Skip for now
      </button>
    </div>
  );
}
