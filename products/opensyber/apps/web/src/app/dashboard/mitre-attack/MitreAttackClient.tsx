'use client';

import { useState } from 'react';
import { Shield, ShieldCheck, ShieldAlert, ShieldOff, X } from 'lucide-react';
import type { Technique, Tactic } from './types';

const CELL_STYLES: Record<Technique['coverage'], string> = {
  full: 'bg-green-500/20 border-green-500/30 hover:bg-green-500/30 text-green-400',
  partial: 'bg-amber-500/20 border-amber-500/30 hover:bg-amber-500/30 text-amber-400',
  none: 'bg-neutral-800 border-neutral-700/30 hover:bg-neutral-700/50 text-neutral-500',
};

function StatCard({ label, value, pct, icon: Icon, color }: {
  label: string; value: number; pct: number;
  icon: typeof Shield; color: string;
}): React.ReactElement {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
      <div className="flex items-center gap-3 mb-2">
        <Icon className={`h-5 w-5 ${color}`} />
        <span className="text-sm text-neutral-400">{label}</span>
      </div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs text-neutral-500 mt-1">{pct}% of total</p>
    </div>
  );
}

function Legend(): React.ReactElement {
  const items = [
    { label: 'Full', cls: 'bg-green-500' },
    { label: 'Partial', cls: 'bg-amber-500' },
    { label: 'None', cls: 'bg-neutral-700' },
  ];
  return (
    <div className="flex items-center gap-4" data-testid="legend">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-1.5">
          <div className={`h-3 w-3 rounded-sm ${i.cls}`} />
          <span className="text-xs text-neutral-400">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

function DetailPanel({ technique, tacticName, onClose }: {
  technique: Technique; tacticName: string; onClose: () => void;
}): React.ReactElement {
  const badgeColor = technique.coverage === 'full'
    ? 'bg-green-500/20 text-green-400'
    : technique.coverage === 'partial'
      ? 'bg-amber-500/20 text-amber-400'
      : 'bg-neutral-700 text-neutral-400';
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium">{technique.name}</h3>
          <p className="text-xs text-neutral-500 mt-0.5">{technique.id} &middot; {tacticName}</p>
        </div>
        <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300 transition">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-neutral-500">Coverage:</span>
        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${badgeColor}`}>
          {technique.coverage === 'full' ? 'Full' : technique.coverage === 'partial' ? 'Partial' : 'None'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
          <p className="text-xs text-neutral-500 mb-1">Detections</p>
          <p className="text-2xl font-bold">{technique.detections}</p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
          <p className="text-xs text-neutral-500 mb-1">Last Seen</p>
          <p className="text-sm font-medium">{technique.lastSeen
            ? new Date(technique.lastSeen).toLocaleDateString()
            : 'Never'}</p>
        </div>
      </div>
      <button className="w-full rounded-lg bg-info/10 px-4 py-2 text-sm font-medium text-info hover:bg-info/20 transition">
        Add Detection
      </button>
    </div>
  );
}

export function MitreAttackClient(): React.ReactElement {
  const [selected, setSelected] = useState<{
    technique: Technique; tacticName: string;
  } | null>(null);

  const tactics: Tactic[] = [];

  const allTechniques = tactics.flatMap((t) => t.techniques);
  const totalTechniques = allTechniques.length;
  const fullCoverage = allTechniques.filter((t) => t.coverage === 'full').length;
  const partialCoverage = allTechniques.filter((t) => t.coverage === 'partial').length;
  const noCoverage = allTechniques.filter((t) => t.coverage === 'none').length;

  const maxRows = tactics.length > 0 ? Math.max(...tactics.map((t) => t.techniques.length)) : 0;
  const pctFull = totalTechniques > 0 ? Math.round((fullCoverage / totalTechniques) * 100) : 0;
  const pctPartial = totalTechniques > 0 ? Math.round((partialCoverage / totalTechniques) * 100) : 0;
  const pctNone = totalTechniques > 0 ? Math.round((noCoverage / totalTechniques) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">MITRE ATT&CK Coverage</h1>
        <p className="mt-2 text-neutral-400">
          Detection coverage mapped to the MITRE ATT&CK framework.
        </p>
      </div>

      {tactics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-800 mb-4">
            <Shield className="h-7 w-7 text-neutral-500" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No MITRE ATT&CK Data Yet</h2>
          <p className="text-sm text-neutral-400 max-w-md">
            Connect your infrastructure to start seeing MITRE ATT&CK coverage data. Data will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Techniques" value={totalTechniques}
              pct={100} icon={Shield} color="text-info" />
            <StatCard label="Full Coverage" value={fullCoverage}
              pct={pctFull} icon={ShieldCheck} color="text-green-500" />
            <StatCard label="Partial Coverage" value={partialCoverage}
              pct={pctPartial} icon={ShieldAlert} color="text-amber-500" />
            <StatCard label="No Coverage" value={noCoverage}
              pct={pctNone} icon={ShieldOff} color="text-red-500" />
          </div>

          {/* Heatmap Grid */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6 overflow-x-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">Technique Matrix</h2>
              <Legend />
            </div>
            <div className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${tactics.length}, minmax(90px, 1fr))` }}>
              {tactics.map((t) => (
                <div key={t.id} className="text-center px-1 pb-2 border-b border-neutral-800">
                  <span className="text-[10px] font-medium text-neutral-300 leading-tight block truncate">
                    {t.name}
                  </span>
                </div>
              ))}
              {Array.from({ length: maxRows }).map((_, row) =>
                tactics.map((tactic) => {
                  const tech = tactic.techniques[row];
                  if (!tech) return <div key={`${tactic.id}-e-${row}`} />;
                  return (
                    <button key={tech.id} title={`${tech.name} (${tech.id})`}
                      onClick={() => setSelected({ technique: tech, tacticName: tactic.name })}
                      className={`rounded-md border px-2 py-1.5 text-[10px] font-medium truncate
                        w-full text-left transition cursor-pointer ${CELL_STYLES[tech.coverage]}`}>
                      {tech.id}
                    </button>
                  );
                }),
              )}
            </div>
          </div>

          {/* Detail Panel */}
          {selected && (
            <DetailPanel technique={selected.technique}
              tacticName={selected.tacticName} onClose={() => setSelected(null)} />
          )}
        </>
      )}
    </div>
  );
}
