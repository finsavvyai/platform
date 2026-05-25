type RunnerStatus = 'busy' | 'idle' | 'offline';

interface Runner {
  name: string;
  os: 'linux' | 'macos';
  status: RunnerStatus;
  cpu: number;
  memory: number;
}

const runners: Runner[] = [
  { name: 'linux-1', os: 'linux', status: 'busy', cpu: 72, memory: 58 },
  { name: 'linux-2', os: 'linux', status: 'idle', cpu: 3, memory: 21 },
  { name: 'macos-1', os: 'macos', status: 'offline', cpu: 0, memory: 0 },
];

const statusColor: Record<RunnerStatus, string> = {
  busy: 'bg-yellow-400', idle: 'bg-emerald-400', offline: 'bg-zinc-600',
};

const osIcon: Record<string, string> = { linux: '🐧', macos: '🍎' };

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

function RunnerRow({ r }: { r: Runner }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-surface-border last:border-0">
      <span className={`w-2 h-2 rounded-full ${statusColor[r.status]} ${r.status === 'busy' ? 'animate-pulse' : ''}`} />
      <span className="text-base">{osIcon[r.os]}</span>
      <span className="text-sm font-medium text-zinc-200 w-24">{r.name}</span>
      <span className={`text-xs px-2 py-0.5 rounded-full ${
        r.status === 'busy' ? 'bg-yellow-500/15 text-yellow-400'
          : r.status === 'idle' ? 'bg-emerald-500/15 text-emerald-400'
          : 'bg-zinc-700/50 text-zinc-500'}`}>
        {r.status}
      </span>
      <div className="flex-1 flex gap-3 items-center ml-4">
        <span className="text-xs text-zinc-500 w-8">CPU</span>
        <div className="flex-1"><Bar value={r.cpu} color="bg-emerald-500" /></div>
        <span className="text-xs text-zinc-500 w-8">Mem</span>
        <div className="flex-1"><Bar value={r.memory} color="bg-sky-500" /></div>
      </div>
    </div>
  );
}

export default function RunnerFleet() {
  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-200">Runner Fleet</h3>
        <button className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400
          hover:bg-emerald-500/20 transition-colors font-medium">+ Add Runner</button>
      </div>
      {runners.map(r => <RunnerRow key={r.name} r={r} />)}
    </div>
  );
}
