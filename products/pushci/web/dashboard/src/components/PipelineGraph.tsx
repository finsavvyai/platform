interface Job {
  name: string;
  status: 'passed' | 'failed' | 'running' | 'pending';
  duration: string;
  dependsOn: string[];
}

const colors = {
  passed: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', text: 'text-emerald-400', dot: '#10b981' },
  failed: { bg: 'bg-red-500/15', border: 'border-red-500/40', text: 'text-red-400', dot: '#ef4444' },
  running: { bg: 'bg-yellow-500/15', border: 'border-yellow-500/40', text: 'text-yellow-400', dot: '#eab308' },
  pending: { bg: 'bg-zinc-500/15', border: 'border-zinc-600/40', text: 'text-zinc-400', dot: '#71717a' },
};

function NodeCard({ job, x, y }: { job: Job; x: number; y: number }) {
  const c = colors[job.status];
  return (
    <foreignObject x={x} y={y} width={150} height={70}>
      <div className={`h-full rounded-xl border ${c.border} ${c.bg} p-3 flex flex-col justify-center`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${job.status === 'running' ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: c.dot }} />
          <span className={`text-sm font-medium ${c.text}`}>{job.name}</span>
        </div>
        <div className="text-xs text-zinc-500 mt-1 ml-4">{job.duration}</div>
      </div>
    </foreignObject>
  );
}

export default function PipelineGraph({ jobs }: { jobs: Job[] }) {
  const idx = Object.fromEntries(jobs.map((j, i) => [j.name, i]));
  const cols: number[] = [];
  const resolve = (j: Job): number => {
    if (cols[idx[j.name]] !== undefined) return cols[idx[j.name]];
    const dep = j.dependsOn.length ? Math.max(...j.dependsOn.map(d => resolve(jobs[idx[d]]))) + 1 : 0;
    cols[idx[j.name]] = dep;
    return dep;
  };
  jobs.forEach(resolve);

  const colGroups: Record<number, number[]> = {};
  jobs.forEach((_, i) => { (colGroups[cols[i]] ??= []).push(i); });
  const maxCol = Math.max(...cols, 0);
  const maxRow = Math.max(...Object.values(colGroups).map(g => g.length), 1);
  const W = (maxCol + 1) * 200 + 50;
  const H = maxRow * 90 + 20;

  const pos = (i: number) => {
    const c = cols[i];
    const row = colGroups[c].indexOf(i);
    return { x: c * 200 + 20, y: row * 90 + 10 };
  };

  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl p-5 overflow-x-auto">
      <h3 className="text-sm font-semibold text-zinc-200 mb-3">Pipeline</h3>
      <svg width={W} height={H} className="min-w-full">
        <defs><marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6" fill="#52525b" />
        </marker></defs>
        {jobs.map((j, i) => j.dependsOn.map(d => {
          const from = pos(idx[d]);
          const to = pos(i);
          return <line key={`${d}-${j.name}`} x1={from.x + 150} y1={from.y + 35}
            x2={to.x} y2={to.y + 35} stroke="#52525b" strokeWidth={1.5} markerEnd="url(#arrow)" />;
        }))}
        {jobs.map((j, i) => <NodeCard key={j.name} job={j} {...pos(i)} />)}
      </svg>
    </div>
  );
}
