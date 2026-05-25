'use client';

import { useState, useMemo, useEffect } from 'react';
import { Shield, CheckCircle, BarChart3, Loader2, Grid3X3 } from 'lucide-react';
import { FRAMEWORKS, CATEGORIES } from './types';
import type { Framework, Category, HeatmapData, CellData } from './types';
import { CellDetailModal } from './CellDetailModal';
import { FrameworkRow } from './FrameworkRow';
import { HeatmapTable, StatCard, buildHeatmapFromApi } from './HeatmapHelpers';

interface ModalState {
  framework: Framework;
  category: Category;
}

function buildEmptyHeatmap(): HeatmapData {
  const result: Record<string, Record<string, CellData>> = {};
  for (const fw of FRAMEWORKS) {
    result[fw] = {};
    for (const cat of CATEGORIES) {
      result[fw][cat] = { score: 0, applicable: false, controls: [] };
    }
  }
  return result as HeatmapData;
}

export function ComplianceHeatmapClient() {
  const [modal, setModal] = useState<ModalState | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData>(buildEmptyHeatmap());
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    fetch('/api/proxy/oasf/assessments')
      .then((r) => r.json())
      .then((d) => {
        const built = buildHeatmapFromApi(d.data);
        if (built) {
          setHeatmap(built);
          setHasData(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    let totalScore = 0;
    let applicableCount = 0;
    let passing = 0;
    let totalControls = 0;

    for (const fw of FRAMEWORKS) {
      for (const cat of CATEGORIES) {
        const cell = heatmap[fw]?.[cat];
        if (cell?.applicable) {
          totalScore += cell.score;
          applicableCount++;
          for (const ctrl of cell.controls) {
            totalControls++;
            if (ctrl.status === 'pass') passing++;
          }
        }
      }
    }
    return {
      frameworks: FRAMEWORKS.length,
      overall: applicableCount > 0 ? Math.round(totalScore / applicableCount) : 0,
      passing,
      totalControls,
    };
  }, [heatmap]);

  const modalData = modal ? heatmap[modal.framework]?.[modal.category] : null;

  return (
    <div className="space-y-8">
      {loading && (
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading compliance data...
        </div>
      )}

      <div>
        <h1 className="text-4xl font-bold">Compliance Heatmap</h1>
        <p className="mt-2 text-neutral-400">
          Bird&apos;s-eye view across compliance frameworks. Click any cell to drill into controls.
        </p>
      </div>

      {!loading && !hasData ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-800 mb-4">
            <Grid3X3 className="h-7 w-7 text-neutral-500" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No Compliance Data Yet</h2>
          <p className="text-sm text-neutral-400 max-w-md">
            Connect your infrastructure to start seeing compliance heatmap data. Data will appear here automatically.
          </p>
        </div>
      ) : null}

      {hasData && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard icon={Shield} label="Frameworks Tracked" value={stats.frameworks} color="text-info" />
            <StatCard icon={BarChart3} label="Overall Compliance" value={`${stats.overall}%`} color="text-green-500" />
            <StatCard icon={CheckCircle} label="Controls Passing" value={`${stats.passing}/${stats.totalControls}`} color="text-amber-500" />
          </div>

          <HeatmapTable heatmap={heatmap} onCellClick={(fw, cat) => heatmap[fw]?.[cat]?.applicable && setModal({ framework: fw, category: cat })} />

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 overflow-hidden">
            <h2 className="px-6 py-4 text-lg font-medium border-b border-neutral-800">Framework Details</h2>
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full">
              <tbody className="divide-y divide-neutral-800/50">
                {FRAMEWORKS.map((fw) => (
                  <FrameworkRow key={fw} framework={fw} cells={heatmap[fw]} />
                ))}
              </tbody>
            </table></div>
          </div>

          {modal && modalData && (
            <CellDetailModal
              framework={modal.framework}
              category={modal.category}
              controls={modalData.controls}
              onClose={() => setModal(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

