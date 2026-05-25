interface SummaryCounts {
  bySeverity: { critical: number; high: number; medium: number; low: number; info: number };
  bySource: { cspm: number; pipewarden: number; tenantiq: number; sdlc: number };
  total: number;
}

const SEV_COLORS: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/30',
  high: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  low: 'bg-signal/10 text-signal border-signal/30',
  info: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
};

const SOURCE_LABELS: Record<keyof SummaryCounts['bySource'], string> = {
  cspm: 'CSPM',
  pipewarden: 'PipeWarden',
  tenantiq: 'TenantIQ',
  sdlc: 'SDLC.cc',
};

const SOURCE_COLORS: Record<keyof SummaryCounts['bySource'], string> = {
  cspm: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  pipewarden: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  tenantiq: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  sdlc: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
};

export function UnifiedFindingsSummary({ summary }: { summary: SummaryCounts }) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(['critical', 'high', 'medium', 'low', 'info'] as const).map((sev) => (
          <div key={sev} className={`rounded-md border px-4 py-3 ${SEV_COLORS[sev]}`}>
            <div className="text-xs uppercase tracking-wide opacity-70">{sev}</div>
            <div className="text-2xl font-semibold mt-1">{summary.bySeverity[sev]}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['cspm', 'pipewarden', 'tenantiq', 'sdlc'] as const).map((src) => (
          <div key={src} className={`rounded-md border px-4 py-3 ${SOURCE_COLORS[src]}`}>
            <div className="text-xs uppercase tracking-wide opacity-70">{SOURCE_LABELS[src]}</div>
            <div className="text-xl font-semibold mt-1">{summary.bySource[src]}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export { SEV_COLORS, SOURCE_LABELS, SOURCE_COLORS };
