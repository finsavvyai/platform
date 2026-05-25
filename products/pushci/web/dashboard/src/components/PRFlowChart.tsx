// PR review flow visualization — shows PR stages with animated connections.

interface PRInfo {
  number?: number;
  title?: string;
  author?: string;
  branch: string;
  status: 'open' | 'review' | 'approved' | 'merged' | 'closed';
  reviewers?: string[];
  checksStatus: 'passed' | 'failed' | 'running' | 'pending';
}

interface Props {
  pr: PRInfo;
}

const STAGES = [
  { id: 'open', label: 'PR Opened', icon: 'O' },
  { id: 'review', label: 'In Review', icon: 'R' },
  { id: 'checks', label: 'CI Checks', icon: 'C' },
  { id: 'approved', label: 'Approved', icon: 'A' },
  { id: 'merged', label: 'Merged', icon: 'M' },
];

const STAGE_ORDER: Record<string, number> = {
  open: 0, review: 1, checks: 2, approved: 3, merged: 4, closed: -1,
};

function stageActive(stageId: string, prStatus: string, checksStatus: string): 'done' | 'active' | 'pending' {
  const prIdx = STAGE_ORDER[prStatus] ?? 0;
  const stageIdx = STAGE_ORDER[stageId] ?? 0;

  if (stageId === 'checks') {
    if (checksStatus === 'passed') return 'done';
    if (checksStatus === 'running') return 'active';
    if (checksStatus === 'failed') return 'done'; // show as done but red
    return prIdx >= 2 ? 'active' : 'pending';
  }

  if (stageIdx < prIdx) return 'done';
  if (stageIdx === prIdx) return 'active';
  return 'pending';
}

export default function PRFlowChart({ pr }: Props) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card/50 p-5">
      {/* PR Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {pr.number && <span className="text-xs text-purple-400 font-mono">#{pr.number}</span>}
            <span className="text-sm font-medium text-zinc-200 truncate">{pr.title || pr.branch}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {pr.author && <span className="text-xs text-zinc-500">{pr.author}</span>}
            <span className="text-xs text-zinc-600">{pr.branch}</span>
          </div>
        </div>
        <span className={`text-[11px] font-medium rounded-full px-2.5 py-1 ${
          pr.status === 'merged' ? 'bg-purple-500/10 text-purple-400' :
          pr.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
          pr.status === 'closed' ? 'bg-zinc-500/10 text-zinc-400' :
          'bg-blue-500/10 text-blue-400'
        }`}>{pr.status}</span>
      </div>

      {/* Flow stages */}
      <div className="flex items-center gap-0">
        {STAGES.map((stage, idx) => {
          const state = stageActive(stage.id, pr.status, pr.checksStatus);
          const isFailed = stage.id === 'checks' && pr.checksStatus === 'failed';

          return (
            <div key={stage.id} className="flex items-center flex-1">
              {/* Node */}
              <div className="flex flex-col items-center flex-1">
                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                  state === 'done'
                    ? isFailed
                      ? 'border-red-500 bg-red-500/10 shadow-lg shadow-red-500/20'
                      : 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/20'
                    : state === 'active'
                      ? 'border-cyan-400 bg-cyan-400/10 shadow-lg shadow-cyan-400/20'
                      : 'border-zinc-700 bg-zinc-800/50'
                }`}>
                  {state === 'done' && !isFailed && (
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {state === 'done' && isFailed && (
                    <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {state === 'active' && (
                    <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
                  )}
                  {state === 'pending' && (
                    <span className="text-xs text-zinc-600 font-mono">{stage.icon}</span>
                  )}
                </div>
                <span className={`text-[10px] mt-1.5 font-medium ${
                  state === 'done' ? (isFailed ? 'text-red-400' : 'text-emerald-400') :
                  state === 'active' ? 'text-cyan-400' : 'text-zinc-600'
                }`}>{stage.label}</span>
              </div>

              {/* Connector */}
              {idx < STAGES.length - 1 && (
                <div className={`h-0.5 flex-1 -mx-1 transition-all duration-500 ${
                  state === 'done' ? (isFailed ? 'bg-red-500/40' : 'bg-emerald-500/40') :
                  state === 'active' ? 'bg-gradient-to-r from-cyan-400/40 to-zinc-700' : 'bg-zinc-800'
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Reviewers */}
      {pr.reviewers && pr.reviewers.length > 0 && (
        <div className="mt-4 pt-3 border-t border-surface-border/50 flex items-center gap-2">
          <span className="text-xs text-zinc-500">Reviewers:</span>
          {pr.reviewers.map(r => (
            <span key={r} className="text-xs bg-surface-hover rounded-full px-2 py-0.5 text-zinc-400">{r}</span>
          ))}
        </div>
      )}
    </div>
  );
}
