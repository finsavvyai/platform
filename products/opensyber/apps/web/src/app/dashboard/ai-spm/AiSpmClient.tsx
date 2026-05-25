'use client';

import { useState, useMemo } from 'react';
import { Brain, ShieldAlert, AlertTriangle, Database } from 'lucide-react';
import type { AIModelType, AIModel } from './types';
import { ModelCard } from './ModelCard';

const TYPE_PILLS: ('All' | AIModelType)[] = ['All', 'llm', 'agent', 'embedding', 'fine-tuned'];
const RISK_OPTIONS = ['All', '0-30', '31-50', '51-70', '71-100'] as const;
type RiskRange = (typeof RISK_OPTIONS)[number];

function inRiskRange(score: number, range: RiskRange): boolean {
  if (range === 'All') return true;
  const [lo, hi] = range.split('-').map(Number);
  return score >= lo && score <= hi;
}

export function AiSpmClient(): React.ReactElement {
  const [typeFilter, setTypeFilter] = useState<'All' | AIModelType>('All');
  const [riskFilter, setRiskFilter] = useState<RiskRange>('All');

  const [models] = useState<AIModel[]>([]);

  const filtered = useMemo(() => {
    return models.filter((m) => {
      if (typeFilter !== 'All' && m.type !== typeFilter) return false;
      if (!inRiskRange(m.riskScore, riskFilter)) return false;
      return true;
    });
  }, [models, typeFilter, riskFilter]);

  const stats = useMemo(() => ({
    total: models.length,
    activeAgents: models.filter((m) => m.type === 'agent' && m.status === 'active').length,
    highRisk: models.filter((m) => m.riskScore > 50).length,
    sensitiveExposed: models.filter((m) => m.sensitiveDataExposure).length,
  }), [models]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">AI Security Posture Management</h1>
        <p className="mt-2 text-neutral-400">
          Monitor all deployed AI models and agents with their security posture, data access, and risk status.
        </p>
      </div>

      {models.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-800 mb-4">
            <Brain className="h-7 w-7 text-neutral-500" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No AI Security Data Yet</h2>
          <p className="text-sm text-neutral-400 max-w-md">
            Connect your infrastructure to start seeing AI model security posture. Data will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <StatCard icon={Brain} label="Total AI Models" value={stats.total} color="text-info" />
            <StatCard icon={ShieldAlert} label="Active Agents" value={stats.activeAgents} color="text-purple-500" />
            <StatCard icon={AlertTriangle} label="High Risk Models" value={stats.highRisk} color="text-red-500" />
            <StatCard icon={Database} label="Sensitive Data Exposed" value={stats.sensitiveExposed} color="text-amber-500" />
          </div>

          <FilterRow
            typeFilter={typeFilter} setTypeFilter={setTypeFilter}
            riskFilter={riskFilter} setRiskFilter={setRiskFilter}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filtered.map((model) => <ModelCard key={model.id} model={model} />)}
          </div>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <Brain className="h-8 w-8 text-neutral-600 mb-3" />
              <p className="text-neutral-400 text-sm">No AI models match current filters.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof Brain; label: string; value: number; color: string;
}): React.ReactElement {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${color}`} />
        <span className="text-sm text-neutral-400">{label}</span>
      </div>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function FilterRow({ typeFilter, setTypeFilter, riskFilter, setRiskFilter }: {
  typeFilter: 'All' | AIModelType; setTypeFilter: (v: 'All' | AIModelType) => void;
  riskFilter: RiskRange; setRiskFilter: (v: RiskRange) => void;
}): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex gap-2">
        {TYPE_PILLS.map((pill) => (
          <button key={pill} onClick={() => setTypeFilter(pill)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              typeFilter === pill
                ? 'bg-info text-white'
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
            }`}
          >{pill === 'All' ? 'All' : pill.toUpperCase()}</button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500">Risk:</span>
        <select value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value as RiskRange)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300"
        >
          {RISK_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
    </div>
  );
}

