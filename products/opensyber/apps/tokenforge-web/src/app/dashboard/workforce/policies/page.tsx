'use client';

import { useCallback, useState } from 'react';
import { ShieldCheck, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useApi, useApiKey } from '@/lib/use-api';
import {
  fetchPolicies,
  deletePolicy,
  updatePolicy,
  type Policy,
} from '@/lib/tokenforge-api-workforce';
import { CreatePolicyForm } from '@/components/dashboard/CreatePolicyForm';

export default function PoliciesPage(): React.ReactElement {
  const apiKey = useApiKey();
  const fetcher = useCallback(
    (token: string, signal: AbortSignal) => fetchPolicies(token, signal),
    [],
  );
  const { data: policies, loading, refetch } = useApi<Policy[]>(fetcher);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Policies</h1>
          <p className="mt-1 text-sm text-text-secondary">
            JSON DSL rules evaluated on every DBSC refresh
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-lg bg-info px-4 py-2 text-sm font-medium text-white hover:bg-info/90 transition"
        >
          <Plus className="h-4 w-4" />
          New Policy
        </button>
      </div>

      {creating && apiKey && (
        <CreatePolicyForm
          apiKey={apiKey}
          onDone={() => { setCreating(false); refetch(); }}
          onCancel={() => setCreating(false)}
        />
      )}

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl border border-border/50 bg-panel" />
      ) : !policies || policies.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-panel/20 p-16 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-info/10">
            <ShieldCheck className="h-8 w-8 text-info" />
          </div>
          <h2 className="mb-2 text-xl font-semibold">No policies yet</h2>
          <p className="max-w-md text-sm text-text-secondary">
            Create a policy to enforce geo-blocking, ASN restrictions, or
            step-up requirements on every DBSC refresh.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {policies.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-border/50 bg-panel px-5 py-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${p.enabled ? 'bg-success/20 text-success' : 'bg-surface text-text-tertiary'}`}>
                    {p.enabled ? 'Active' : 'Disabled'}
                  </span>
                  <span className="text-xs text-text-tertiary">Priority {p.priority}</span>
                </div>
                <pre className="mt-1.5 max-w-xl truncate text-xs text-text-secondary">{p.rules}</pre>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title={p.enabled ? 'Disable policy' : 'Enable policy'}
                  onClick={async () => { await updatePolicy(apiKey!, p.id, { enabled: !p.enabled }); refetch(); }}
                  className="p-2 hover:bg-surface rounded-lg transition"
                >
                  {p.enabled
                    ? <ToggleRight className="h-5 w-5 text-success" />
                    : <ToggleLeft className="h-5 w-5 text-text-tertiary" />}
                </button>
                <button
                  type="button"
                  title="Delete policy"
                  onClick={async () => { await deletePolicy(apiKey!, p.id); refetch(); }}
                  className="p-2 hover:bg-destructive/10 rounded-lg transition"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
