import ArtifactReport from '../components/ArtifactReport';
import type { SizeChange } from '../components/ArtifactReport';
import PageHeader from '../components/PageHeader';

// Placeholder data shown before API data loads.
const sampleChanges: SizeChange[] = [];

const sampleHistory: { run: string; docker: number; bundle: number; binary: number }[] = [];

function HistoryChart() {
  const maxVal = 280;
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-4 mt-6">
      <h3 className="text-sm font-medium text-zinc-300 mb-4">Size History (MB)</h3>
      <div className="flex items-end gap-3 h-40">
        {sampleHistory.map((h) => (
          <div key={h.run} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex flex-col gap-0.5">
              <div
                className="w-full bg-red-500/60 rounded-t"
                style={{ height: `${(h.docker / maxVal) * 120}px` }}
                title={`Docker: ${h.docker}MB`}
              />
              <div
                className="w-full bg-emerald-500/60"
                style={{ height: `${(h.binary / maxVal) * 120}px` }}
                title={`Binary: ${h.binary}MB`}
              />
              <div
                className="w-full bg-blue-500/60 rounded-b"
                style={{ height: `${(h.bundle / maxVal) * 120}px` }}
                title={`Bundle: ${h.bundle}MB`}
              />
            </div>
            <span className="text-xs text-zinc-500 mt-1">{h.run}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-3 text-xs text-zinc-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500/60 rounded" /> Docker</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500/60 rounded" /> Binary</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500/60 rounded" /> Bundle</span>
      </div>
    </div>
  );
}

export default function ArtifactsPage() {
  return (
    <div className="p-6 max-w-5xl">
      <PageHeader title="Artifacts" subtitle="Track build artifact sizes across runs" />
      <ArtifactReport changes={sampleChanges} />
      <HistoryChart />
    </div>
  );
}
