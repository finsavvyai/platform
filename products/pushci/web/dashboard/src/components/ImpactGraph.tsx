// Impact analysis visualization — blast radius graph.

import { useState } from 'react';
import { API_BASE_URL } from '../config';

interface ImpactData {
  changed_files: string[];
  affected_files: string[];
  blast_radius: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  suggested_tests: string[];
  summary: string;
}

interface Props {
  repo: string;
  sha: string;
  changedFiles?: string[];
}

const RISK_COLORS = {
  low: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', ring: 'ring-emerald-500/20' },
  medium: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', ring: 'ring-amber-500/20' },
  high: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', ring: 'ring-orange-500/20' },
  critical: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', ring: 'ring-red-500/20' },
};

export default function ImpactGraph({ repo, changedFiles }: Props) {
  const [impact, setImpact] = useState<ImpactData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const analyze = async () => {
    if (!changedFiles?.length) return;
    setLoading(true);
    const token = localStorage.getItem('pushci_token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/impact/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ repo, changed_files: changedFiles }),
      });
      if (res.ok) setImpact(await res.json() as ImpactData);
    } catch {} finally { setLoading(false); }
  };

  if (!changedFiles?.length && !impact) return null;

  const risk = impact ? RISK_COLORS[impact.risk_level] : RISK_COLORS.low;

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card/50 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <h3 className="text-sm font-semibold text-zinc-200">Impact Analysis</h3>
        </div>
        {!impact && !loading && (
          <button onClick={analyze}
            className="text-xs text-accent hover:text-accent-hover transition px-3 py-1.5 rounded-lg border border-accent/20 bg-accent/5 hover:bg-accent/10">
            Analyze Blast Radius
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-4">
          <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          <span className="text-xs text-zinc-400">Analyzing change impact...</span>
        </div>
      )}

      {impact && (
        <div className="space-y-4">
          {/* Risk badge + summary */}
          <div className={`rounded-lg ${risk.bg} ${risk.border} border p-3`}>
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-[11px] font-bold uppercase ${risk.text} px-2 py-0.5 rounded-full ${risk.bg} ring-1 ${risk.ring}`}>
                {impact.risk_level} risk
              </span>
              <span className="text-xs text-zinc-400">
                {impact.blast_radius} files in blast radius
              </span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">{impact.summary}</p>
          </div>

          {/* Blast radius visual */}
          <div className="flex items-center gap-4">
            {/* Center = changed files */}
            <div className="relative">
              <div className={`w-16 h-16 rounded-full ${risk.bg} ${risk.border} border-2 flex items-center justify-center`}>
                <div className="text-center">
                  <div className={`text-lg font-bold ${risk.text}`}>{impact.changed_files.length}</div>
                  <div className="text-[9px] text-zinc-500">changed</div>
                </div>
              </div>
              {/* Ripple effect */}
              <div className={`absolute inset-0 rounded-full ${risk.border} border animate-ping opacity-20`} />
            </div>
            {/* Arrow */}
            <div className="flex-1 h-0.5 bg-gradient-to-r from-purple-500/40 to-zinc-700 relative">
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[6px] border-l-zinc-600 border-y-[4px] border-y-transparent" />
            </div>
            {/* Outer = affected files */}
            <div className="w-16 h-16 rounded-full bg-zinc-800/50 border border-zinc-700 flex items-center justify-center">
              <div className="text-center">
                <div className="text-lg font-bold text-zinc-300">{impact.blast_radius}</div>
                <div className="text-[9px] text-zinc-500">affected</div>
              </div>
            </div>
          </div>

          {/* Suggested tests */}
          {impact.suggested_tests.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-zinc-400 mb-2">Suggested Test Scope</h4>
              <div className="flex flex-wrap gap-1.5">
                {impact.suggested_tests.map((t, i) => (
                  <span key={i} className="text-[11px] bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full px-2.5 py-0.5">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Expandable file lists */}
          <button onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 transition">
            {expanded ? 'Hide' : 'Show'} affected files
          </button>
          {expanded && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <h5 className="text-[10px] uppercase text-zinc-500 mb-1">Changed</h5>
                <div className="space-y-1">
                  {impact.changed_files.map(f => (
                    <div key={f} className="text-[11px] text-amber-400 font-mono truncate">{f}</div>
                  ))}
                </div>
              </div>
              <div>
                <h5 className="text-[10px] uppercase text-zinc-500 mb-1">Affected</h5>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {impact.affected_files.map(f => (
                    <div key={f} className="text-[11px] text-zinc-400 font-mono truncate">{f}</div>
                  ))}
                  {impact.affected_files.length === 0 && (
                    <div className="text-[11px] text-zinc-600">No downstream dependencies detected</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
