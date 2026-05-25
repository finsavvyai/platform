'use client';

import type { AIModel, AIModelType } from './types';

const TYPE_COLORS: Record<AIModelType, string> = {
  llm: 'bg-info/15 text-info',
  agent: 'bg-purple-500/15 text-purple-400',
  embedding: 'bg-emerald-500/15 text-emerald-400',
  'fine-tuned': 'bg-amber-500/15 text-amber-400',
};

function riskColor(score: number): string {
  if (score <= 30) return 'text-green-400';
  if (score <= 50) return 'text-amber-400';
  if (score <= 70) return 'text-orange-400';
  return 'text-red-400';
}

function riskBarColor(score: number): string {
  if (score <= 30) return 'bg-green-500';
  if (score <= 50) return 'bg-amber-500';
  if (score <= 70) return 'bg-orange-500';
  return 'bg-red-500';
}

function StatusDot({ status }: { status: AIModel['status'] }): React.ReactElement {
  const cls = status === 'active' ? 'bg-green-500' : status === 'monitoring' ? 'bg-amber-500' : 'bg-neutral-500';
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />;
}

export function ModelCard({ model }: { model: AIModel }): React.ReactElement {
  const total = model.promptInjectionTests.passed + model.promptInjectionTests.failed;
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-5 transition hover:border-neutral-700">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium truncate">{model.name}</h3>
            <span className="text-xs text-neutral-500">{model.provider}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium uppercase ${TYPE_COLORS[model.type]}`}>
              {model.type}
            </span>
            <StatusDot status={model.status} />
            <span className="text-[10px] text-neutral-500 capitalize">{model.status}</span>
          </div>
        </div>
        <span className={`text-2xl font-bold ${riskColor(model.riskScore)}`}>{model.riskScore}</span>
      </div>

      <div className="mb-3">
        <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
          <div className={`h-full rounded-full ${riskBarColor(model.riskScore)}`}
            style={{ width: `${model.riskScore}%` }} />
        </div>
      </div>

      <div className="mb-3">
        <span className="text-xs text-neutral-500">Data Access:</span>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {model.dataAccess.map((d) => (
            <span key={d} className="rounded-md bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-300">{d}</span>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <span className="text-xs text-neutral-500">Permissions:</span>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {model.permissions.map((p) => (
            <span key={p} className="rounded-md bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-300">{p}</span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-3 text-xs">
        <span className="text-neutral-500">Prompt Injection:</span>
        <span className="text-green-400">{model.promptInjectionTests.passed} passed</span>
        <span className="text-red-400">{model.promptInjectionTests.failed} failed</span>
        <span className="text-neutral-500">({total} total)</span>
      </div>

      {model.sensitiveDataExposure && (
        <div className="mb-3 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400">
          Sensitive data exposure detected
        </div>
      )}

      {model.complianceFlags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {model.complianceFlags.map((f) => (
            <span key={f} className="rounded-md bg-info/10 px-2 py-0.5 text-[10px] text-info font-medium">{f}</span>
          ))}
        </div>
      )}

      <div className="pt-3 border-t border-neutral-800">
        <span className="text-[10px] text-neutral-500">
          Last activity: {new Date(model.lastActivity).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
