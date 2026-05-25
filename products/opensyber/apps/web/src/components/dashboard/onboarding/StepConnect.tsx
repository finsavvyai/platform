'use client';

import { useEffect, useState } from 'react';
import { ConnectAgentCard } from '../ConnectAgentCard';
import { Loader2 } from 'lucide-react';

/**
 * Step 2 — Connect the user's machine to the agent they just deployed.
 *
 * Reached ONLY after StepDeploy has verified the instance is in
 * `running` state, which means the gateway token has been persisted to
 * KV and the `/api/instances/:id/gateway-token` endpoint will resolve
 * cleanly. If the instance list is still empty (e.g. the user skipped
 * the deploy step) we fall back to an informational message rather
 * than trapping them in a failed fetch loop.
 *
 * Polls the instance list every 2s if no instance exists yet, so the
 * flow recovers gracefully from a race between the deploy step's
 * success callback and the /api/instances list consistency window.
 */
export function StepConnect({ onNext }: { onNext: () => void }) {
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [gatewayToken, setGatewayToken] = useState<string | null>(null);
  const [hasEvents, setHasEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load instance ID, then gateway token. Poll every 2s until we see
  // an instance — the deploy step's poll may race with the list cache.
  useEffect(() => {
    let cancelled = false;

    async function loadInstance(attempt = 0): Promise<void> {
      if (cancelled) return;
      try {
        const res = await fetch('/api/proxy/instances');
        if (res.ok) {
          const data = await res.json() as { instances?: Array<{ id: string }> };
          const id = data.instances?.[0]?.id;
          if (id) {
            setInstanceId(id);
            return;
          }
        }
      } catch {
        // Keep polling.
      }
      if (attempt < 5 && !cancelled) {
        setTimeout(() => loadInstance(attempt + 1), 2000);
      } else if (!cancelled) {
        setError('No agent instance found. Please deploy one first.');
      }
    }
    void loadInstance();
    return () => { cancelled = true; };
  }, []);

  // Once we have an instance, fetch the gateway token.
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
      } catch {
        // Token fetch errors surface via the Card's empty state.
      }
    })();
    return () => { cancelled = true; };
  }, [instanceId]);

  // Poll for first event so the wizard can advance automatically
  // when the user's CLI test event lands. 3s interval, stops on first hit.
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
            return;
          }
        }
      } catch {
        // Keep polling.
      }
      if (!cancelled) setTimeout(poll, 3000);
    };
    void poll();
    return () => { cancelled = true; };
  }, [instanceId, hasEvents]);

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-red-400 mb-4">{error}</p>
        <button
          onClick={onNext}
          className="rounded-lg bg-info px-6 py-3 text-sm font-medium text-white hover:bg-info transition-colors"
        >
          Continue anyway
        </button>
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
      <h3 className="text-lg font-medium text-white mb-1">Connect Your Machine</h3>
      <p className="text-sm text-neutral-400 mb-6 text-center max-w-md">
        Install the CLI, MCP server, or VS Code extension and send your first event.
      </p>
      <div className="w-full">
        <ConnectAgentCard
          instanceId={instanceId}
          gatewayToken={gatewayToken}
          hasEvents={hasEvents}
        />
      </div>
      <button
        onClick={onNext}
        className="mt-6 rounded-lg bg-info px-6 py-3 text-sm font-medium text-white hover:bg-info transition-colors"
      >
        {hasEvents ? 'Continue →' : 'Finish setup'}
      </button>
      {!hasEvents && (
        <button
          onClick={onNext}
          className="text-xs text-neutral-500 hover:text-neutral-300 mt-3 transition-colors"
        >
          Skip for now
        </button>
      )}
    </div>
  );
}
