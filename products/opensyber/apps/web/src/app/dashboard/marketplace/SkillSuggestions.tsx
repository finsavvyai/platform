'use client';

import { useState } from 'react';
import { Lightbulb, Plus, X, Shield, ChevronRight } from 'lucide-react';

interface Recommendation {
  skillSlug: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  signal: string;
  skill: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    tier: string;
    category: string;
  } | null;
}

interface Instance {
  id: string;
  name: string;
}

const priorityStyles: Record<string, string> = {
  high: 'border-red-500/30 bg-red-500/5',
  medium: 'border-amber-500/30 bg-amber-500/5',
  low: 'border-info/30 bg-info/5',
};

const priorityDot: Record<string, string> = {
  high: 'bg-red-400',
  medium: 'bg-amber-400',
  low: 'bg-info',
};

export function SkillSuggestions({
  recommendations,
  agents,
  onInstall,
  installedSkillIds = [],
}: {
  recommendations: Recommendation[];
  agents: Instance[];
  onInstall: (skillId: string) => void;
  installedSkillIds?: string[];
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const installedSet = new Set(installedSkillIds);

  const visible = recommendations.filter(
    (r) => r.skill && !dismissed.has(r.skillSlug) && !installedSet.has(r.skill.id),
  );

  if (visible.length === 0) return null;

  const quickInstall = async (rec: Recommendation) => {
    if (!rec.skill || agents.length === 0) return;
    setInstalling(rec.skillSlug);
    setError(null);
    try {
      // Quick install: install on all agents
      for (const agent of agents) {
        const res = await fetch('/api/proxy/marketplace/install', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skillId: rec.skill.id, instanceId: agent.id }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { message?: string }).message ?? `Failed (${res.status})`);
        }
      }
      setDismissed((prev) => new Set([...prev, rec.skillSlug]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className="rounded border border-border bg-panel/50 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="h-4 w-4 text-amber-400" />
        <h2 className="text-sm font-semibold">Recommended for you</h2>
        <span className="text-xs text-text-dim">
          Based on your agent configuration
        </span>
      </div>

      {error && <p className="text-sm text-red-400 mt-2 mb-2">{error}</p>}

      <div className="space-y-2">
        {visible.map((rec) => (
          <div
            key={rec.skillSlug}
            className={`flex items-center gap-3 rounded-lg border p-3 transition ${priorityStyles[rec.priority]}`}
          >
            <div className={`h-2 w-2 rounded-full flex-shrink-0 ${priorityDot[rec.priority]}`} />
            <Shield className="h-4 w-4 text-text-secondary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{rec.skill?.name}</p>
              <p className="text-xs text-text-secondary truncate">{rec.reason}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {agents.length > 0 && (
                <button
                  onClick={() => quickInstall(rec)}
                  disabled={installing === rec.skillSlug}
                  className="flex items-center gap-1 rounded-md bg-signal px-2.5 py-1 text-xs font-medium text-white hover:bg-signal-hover disabled:opacity-50"
                >
                  {installing === rec.skillSlug ? (
                    'Installing...'
                  ) : (
                    <>
                      <Plus className="h-3 w-3" />
                      {agents.length === 1 ? 'Install' : 'Install All'}
                    </>
                  )}
                </button>
              )}
              <button
                onClick={() => onInstall(rec.skill!.id)}
                className="rounded-md p-1 text-text-dim hover:text-white hover:bg-surface"
                title="Choose agents"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setDismissed((prev) => new Set([...prev, rec.skillSlug]))}
                className="rounded-md p-1 text-text-dim hover:text-text-secondary"
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
