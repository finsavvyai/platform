// Animated pipeline flow visualization — "flux capacitor" style.

import type { Check } from '../data/types';

interface Props {
  steps: Check[];
  status: 'passed' | 'failed' | 'running' | 'cancelled';
}

const STATUS_COLORS: Record<string, { ring: string; glow: string; text: string }> = {
  passed: { ring: 'border-emerald-500', glow: 'shadow-emerald-500/30', text: 'text-emerald-400' },
  failed: { ring: 'border-red-500', glow: 'shadow-red-500/30', text: 'text-red-400' },
  running: { ring: 'border-cyan-400', glow: 'shadow-cyan-400/30', text: 'text-cyan-400' },
  pending: { ring: 'border-zinc-600', glow: '', text: 'text-zinc-500' },
};

function getStepStatus(step: Check, idx: number, steps: Check[], runStatus: string): string {
  if (step.status === 'passed') return 'passed';
  if (step.status === 'failed') return 'failed';
  if (runStatus === 'running') {
    const prevDone = idx === 0 || steps.slice(0, idx).every(s => s.status === 'passed' || s.status === 'failed');
    if (prevDone) return 'running';
  }
  return 'pending';
}

export default function PipelineFlow({ steps, status }: Props) {
  if (steps.length === 0) return null;

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        <h3 className="text-sm font-semibold text-zinc-200">Pipeline Flow</h3>
        <span className="text-[11px] text-zinc-500">{steps.length} steps</span>
      </div>

      {/* Flow container */}
      <div className="relative pl-6">
        {/* Vertical line */}
        <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-accent/40 via-accent/20 to-transparent" />

        {/* Animated pulse on the line when running */}
        {status === 'running' && (
          <div className="absolute left-[9px] w-1.5 h-8 bg-gradient-to-b from-cyan-400 to-transparent rounded-full animate-flow-pulse"
            style={{ animationDuration: '2s' }} />
        )}

        {steps.map((step, idx) => {
          const stepStatus = getStepStatus(step, idx, steps, status);
          const colors = STATUS_COLORS[stepStatus] || STATUS_COLORS.pending;

          return (
            <div key={idx} className="relative mb-1 last:mb-0"
              style={{ animationDelay: `${idx * 100}ms` }}>
              {/* Node */}
              <div className={`absolute -left-6 top-3 w-[22px] h-[22px] rounded-full border-2 ${colors.ring} bg-surface-card flex items-center justify-center shadow-lg ${colors.glow} transition-all duration-500`}>
                {stepStatus === 'passed' && (
                  <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {stepStatus === 'failed' && (
                  <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {stepStatus === 'running' && (
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                )}
                {stepStatus === 'pending' && (
                  <div className="w-2 h-2 rounded-full bg-zinc-600" />
                )}
              </div>

              {/* Content card */}
              <div className={`ml-4 rounded-lg border px-4 py-3 transition-all duration-300 ${
                stepStatus === 'running'
                  ? 'border-cyan-500/30 bg-cyan-500/5 shadow-lg shadow-cyan-500/10'
                  : stepStatus === 'failed'
                    ? 'border-red-500/20 bg-red-500/5'
                    : stepStatus === 'passed'
                      ? 'border-surface-border/50 bg-surface-card/50'
                      : 'border-surface-border/30 bg-surface-card/30 opacity-60'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${colors.text}`}>{step.name}</span>
                    {stepStatus === 'running' && (
                      <span className="text-[10px] text-cyan-400 bg-cyan-500/10 rounded-full px-2 py-0.5 animate-pulse">
                        Running
                      </span>
                    )}
                  </div>
                  {step.duration && step.duration !== '0s' && (
                    <span className="text-[11px] text-zinc-500 font-mono">{step.duration}</span>
                  )}
                </div>

                {/* Energy flow bar */}
                {stepStatus === 'running' && (
                  <div className="mt-2 h-1 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 animate-flow-bar" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
