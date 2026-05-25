'use client';

import { Shield } from 'lucide-react';
import { FRAMEWORKS, CATEGORIES } from './types';
import type { Framework, Category, HeatmapData, CellData, ControlDetail } from './types';
import { HeatmapCell } from './HeatmapCell';

export function HeatmapTable({ heatmap, onCellClick }: { heatmap: HeatmapData; onCellClick: (fw: Framework, cat: Category) => void }): React.ReactElement {
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/30">
      <table className="w-full min-w-[800px]">
        <thead>
          <tr className="border-b border-neutral-800">
            <th className="p-3 text-left text-xs font-medium text-neutral-500 w-32">Framework</th>
            {CATEGORIES.map((cat) => (
              <th key={cat} className="p-3 text-center text-xs font-medium text-neutral-500 whitespace-nowrap">{cat}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800/50">
          {FRAMEWORKS.map((fw) => (
            <tr key={fw} className="hover:bg-neutral-800/20 transition">
              <td className="p-3 text-sm font-medium whitespace-nowrap">{fw}</td>
              {CATEGORIES.map((cat) => (
                <HeatmapCell key={cat} cell={heatmap[fw]?.[cat] ?? { score: 0, applicable: false, controls: [] }} onClick={() => onCellClick(fw, cat)} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof Shield; label: string; value: string | number; color: string;
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

export function buildHeatmapFromApi(data: unknown): HeatmapData | null {
  if (!data || !Array.isArray(data)) return null;
  const result: Record<string, Record<string, CellData>> = {};
  for (const fw of FRAMEWORKS) {
    result[fw] = {};
    for (const cat of CATEGORIES) {
      result[fw][cat] = { score: 0, applicable: false, controls: [] };
    }
  }
  for (const ctrl of data) {
    const fw = (ctrl.framework ?? 'OASF') as string;
    const cat = (ctrl.category ?? 'Access Control') as string;
    if (!result[fw]) continue;
    if (!result[fw][cat]) continue;
    const detail: ControlDetail = {
      name: ctrl.name ?? ctrl.controlId ?? 'Unknown',
      status: ctrl.result === 'pass' ? 'pass' : ctrl.result === 'fail' ? 'fail' : 'partial',
      evidenceCount: ctrl.evidenceCount ?? 0,
      lastAssessed: ctrl.assessedAt ?? new Date().toISOString(),
    };
    result[fw][cat].controls.push(detail);
    result[fw][cat].applicable = true;
  }
  for (const fw of FRAMEWORKS) {
    for (const cat of CATEGORIES) {
      const cell = result[fw][cat];
      if (cell.controls.length > 0) {
        const passCount = cell.controls.filter((c) => c.status === 'pass').length;
        cell.score = Math.round((passCount / cell.controls.length) * 100);
      }
    }
  }
  return result as HeatmapData;
}
