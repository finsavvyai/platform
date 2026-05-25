'use client';

import { useState } from 'react';
import { Check, X, Server, AlertCircle, Settings } from 'lucide-react';
import Link from 'next/link';

interface Skill {
  id: string;
  name: string;
}

interface Instance {
  id: string;
  name: string;
  status: string;
}

export function InstallModal({
  skill,
  agents,
  onClose,
}: {
  skill: Skill;
  agents: Instance[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [installing, setInstalling] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedAgents, setFailedAgents] = useState<string[]>([]);
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);
    const failed: string[] = [];
    try {
      for (const instanceId of selected) {
        const res = await fetch('/api/proxy/marketplace/install', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skillId: skill.id, instanceId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { message?: string };
          const agent = agents.find((a) => a.id === instanceId);
          failed.push(agent?.name ?? instanceId);
          if (data.message?.includes('limit')) {
            setError(data.message);
          }
        }
      }
      if (failed.length > 0 && failed.length === selected.size) {
        setError(error ?? `Failed to install on: ${failed.join(', ')}`);
        setFailedAgents(failed);
      } else {
        setDone(true);
        setFailedAgents(failed);
      }
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded border border-border bg-panel p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Install {skill.name}</h2>
          <button onClick={onClose} className="text-text-dim hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center py-8">
            <Check className="h-12 w-12 text-green-400 mb-3" />
            <p className="font-medium">
              Installed on {selected.size - failedAgents.length} agent{selected.size - failedAgents.length !== 1 ? 's' : ''}
            </p>
            {failedAgents.length > 0 && (
              <p className="mt-1 text-xs text-amber-400">
                Failed on: {failedAgents.join(', ')}
              </p>
            )}
            <div className="mt-4 flex gap-3">
              <Link
                href={`/dashboard/skills/${skill.id}/configure`}
                className="inline-flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-hover transition"
              >
                <Settings className="h-4 w-4" /> Configure Skill
              </Link>
              <button
                onClick={onClose}
                className="rounded-lg bg-surface px-4 py-2 text-sm hover:bg-neutral-700"
              >
                Close
              </button>
            </div>
          </div>
        ) : agents.length === 0 ? (
          <div className="py-8 text-center">
            <Server className="h-10 w-10 text-text-dim mx-auto mb-3" />
            <p className="text-sm text-text-secondary">No agents deployed yet.</p>
            <p className="text-xs text-text-dim mt-1">
              Deploy an agent first to install skills.
            </p>
            <Link
              href="/dashboard"
              className="mt-3 inline-block text-xs text-signal underline hover:text-signal-hover"
            >
              Go to Dashboard to deploy
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-text-secondary mb-4">
              Select which agent(s) to install this skill on:
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => toggle(agent.id)}
                  disabled={agent.status !== 'running'}
                  className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                    agent.status !== 'running'
                      ? 'border-border opacity-50 cursor-not-allowed'
                      : selected.has(agent.id)
                        ? 'border-info bg-signal/10'
                        : 'border-border hover:border-wire'
                  }`}
                >
                  <div className={`flex h-5 w-5 items-center justify-center rounded border ${
                    selected.has(agent.id) ? 'border-info bg-info' : 'border-neutral-600'
                  }`}>
                    {selected.has(agent.id) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{agent.name}</p>
                    <p className="text-xs text-text-dim capitalize">{agent.status}</p>
                  </div>
                </button>
              ))}
            </div>
            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <div>
                  <span>{error}</span>
                  {error.includes('limit') && (
                    <Link href="/pricing" className="ml-1 text-signal underline hover:text-signal-hover">
                      Upgrade your plan
                    </Link>
                  )}
                </div>
              </div>
            )}
            <button
              onClick={handleInstall}
              disabled={selected.size === 0 || installing}
              className="mt-4 w-full rounded-lg bg-signal py-2 text-sm font-medium text-white transition hover:bg-signal-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {installing
                ? 'Installing...'
                : `Install on ${selected.size} agent${selected.size !== 1 ? 's' : ''}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
