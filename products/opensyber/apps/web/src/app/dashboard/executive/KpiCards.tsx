'use client';

import type { ExecutiveKpi } from './types';

interface KpiCardProps {
  label: string;
  value: string;
  unit: string;
  delta: number;
  deltaLabel: string;
  invertDelta?: boolean;
}

function KpiCard({ label, value, unit, delta, deltaLabel, invertDelta }: KpiCardProps) {
  const isPositive = invertDelta ? delta < 0 : delta > 0;
  const isNegative = invertDelta ? delta > 0 : delta < 0;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
      <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="text-3xl font-bold">{value}</span>
        <span className="text-sm text-neutral-400">{unit}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {isPositive && (
          <span className="text-green-400 text-xs font-medium flex items-center gap-0.5">
            <TrendArrow direction="up" /> {deltaLabel}
          </span>
        )}
        {isNegative && (
          <span className="text-red-400 text-xs font-medium flex items-center gap-0.5">
            <TrendArrow direction="down" /> {deltaLabel}
          </span>
        )}
        {delta === 0 && (
          <span className="text-neutral-500 text-xs">No change</span>
        )}
      </div>
    </div>
  );
}

function TrendArrow({ direction }: { direction: 'up' | 'down' }) {
  if (direction === 'up') {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M5 1L9 6H1L5 1Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M5 9L1 4H9L5 9Z" fill="currentColor" />
    </svg>
  );
}

interface KpiCardsProps {
  kpis: ExecutiveKpi;
}

export function KpiCards({ kpis }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpi-cards">
      <KpiCard
        label="Mean Time to Detect"
        value={kpis.mttdHours.toFixed(1)}
        unit="hrs"
        delta={kpis.mttdDelta}
        deltaLabel={`${Math.abs(kpis.mttdDelta)}h improvement`}
        invertDelta
      />
      <KpiCard
        label="Mean Time to Remediate"
        value={kpis.mttrHours.toFixed(1)}
        unit="hrs"
        delta={kpis.mttrDelta}
        deltaLabel={`${Math.abs(kpis.mttrDelta)}h improvement`}
        invertDelta
      />
      <KpiCard
        label="Open Critical Findings"
        value={String(kpis.openCritical)}
        unit="findings"
        delta={kpis.openCriticalDelta}
        deltaLabel={`${Math.abs(kpis.openCriticalDelta)} fewer`}
        invertDelta
      />
      <KpiCard
        label="Compliance Score"
        value={String(kpis.complianceScore)}
        unit="%"
        delta={kpis.complianceDelta}
        deltaLabel={`+${kpis.complianceDelta}%`}
      />
    </div>
  );
}
