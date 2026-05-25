'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, Plus } from 'lucide-react';
import { type AgentPolicy, RULE_TYPE_LABELS, RULE_TYPE_COLORS, SEV_COLORS } from './types';
import { CreatePolicyModal } from './CreatePolicyModal';

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<AgentPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadPolicies() {
    setLoading(true);
    fetch('/api/proxy/agents/policies')
      .then((r) => r.json())
      .then((d) => setPolicies(d.data ?? d.policies ?? []))
      .catch(() => setPolicies([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadPolicies(); }, []);

  async function toggleActive(policy: AgentPolicy) {
    setError(null);
    try {
      const res = await fetch(`/api/proxy/agents/policies/${policy.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !policy.isActive }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `Failed (${res.status})`);
      }
      loadPolicies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  async function deletePolicy(id: string) {
    if (!confirm('Delete this policy? This cannot be undone.')) return;
    setError(null);
    try {
      const res = await fetch(`/api/proxy/agents/policies/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `Failed (${res.status})`);
      }
      loadPolicies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-wire border-t-info" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agent Policies</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Define rules to detect risky agent behavior
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-medium hover:bg-signal-hover transition"
        >
          <Plus className="h-4 w-4" />
          Create Policy
        </button>
      </div>

      {error && <p className="text-sm text-red-400 mt-2 mb-4">{error}</p>}

      {policies.length === 0 ? (
        <div className="rounded border border-border bg-panel/30 p-12 text-center">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-text-dim" />
          <p className="text-lg font-medium text-text-secondary">No policies configured</p>
          <p className="mt-2 text-sm text-text-dim">
            Create your first policy to start monitoring agent behavior.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 rounded-lg bg-signal px-4 py-2 text-sm font-medium hover:bg-signal-hover transition"
          >
            Create First Policy
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-border bg-panel/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Rule Type</th>
                <th className="px-6 py-3 font-medium">Severity</th>
                <th className="px-6 py-3 font-medium">Active</th>
                <th className="px-6 py-3 font-medium">Violations</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {policies.map((p) => (
                <tr key={p.id} className="hover:bg-surface/30 transition">
                  <td className="px-6 py-3 font-medium">{p.name}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${RULE_TYPE_COLORS[p.ruleType] ?? ''}`}>
                      {RULE_TYPE_LABELS[p.ruleType] ?? p.ruleType}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${SEV_COLORS[p.severity]}`}>
                      {p.severity}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => toggleActive(p)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${p.isActive ? 'bg-green-600' : 'bg-neutral-700'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${p.isActive ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                  <td className="px-6 py-3">
                    <span className={p.violationCount > 0 ? 'text-red-400 font-medium' : 'text-text-dim'}>
                      {p.violationCount}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => deletePolicy(p.id)}
                      className="rounded-lg border border-red-500/30 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <CreatePolicyModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); loadPolicies(); }}
        />
      )}
    </div>
  );
}
