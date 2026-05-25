interface SizeChange {
  name: string;
  oldSize: number;
  newSize: number;
  diffBytes: number;
  diffPercent: number;
}

function formatSize(bytes: number): string {
  const abs = Math.abs(bytes);
  if (abs >= 1e9) return `${(bytes / 1e9).toFixed(1)}GB`;
  if (abs >= 1e6) return `${(bytes / 1e6).toFixed(1)}MB`;
  if (abs >= 1e3) return `${(bytes / 1e3).toFixed(1)}KB`;
  return `${bytes}B`;
}

function ChangeBar({ pct }: { pct: number }) {
  const width = Math.min(Math.abs(pct), 100);
  const color = pct > 20 ? 'bg-red-500' : pct < 0 ? 'bg-emerald-500' : 'bg-yellow-500';
  return (
    <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
    </div>
  );
}

export default function ArtifactReport({ changes }: { changes: SizeChange[] }) {
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-border text-zinc-400 text-left">
            <th className="px-4 py-3 font-medium">Artifact</th>
            <th className="px-4 py-3 font-medium">Old Size</th>
            <th className="px-4 py-3 font-medium">New Size</th>
            <th className="px-4 py-3 font-medium">Change</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          {changes.map((c) => (
            <tr key={c.name} className="border-b border-surface-border last:border-0">
              <td className="px-4 py-3 text-zinc-200 font-medium flex items-center gap-2">
                {c.diffPercent > 20 && <span title="Bloat detected">&#9888;</span>}
                {c.name}
              </td>
              <td className="px-4 py-3 text-zinc-400">{formatSize(c.oldSize)}</td>
              <td className="px-4 py-3 text-zinc-200">{formatSize(c.newSize)}</td>
              <td className="px-4 py-3">
                <span className={c.diffPercent > 20 ? 'text-red-400' : c.diffBytes < 0 ? 'text-emerald-400' : 'text-yellow-400'}>
                  {c.diffBytes > 0 ? '+' : ''}{formatSize(c.diffBytes)} ({c.diffPercent.toFixed(1)}%)
                </span>
              </td>
              <td className="px-4 py-3"><ChangeBar pct={c.diffPercent} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type { SizeChange };
