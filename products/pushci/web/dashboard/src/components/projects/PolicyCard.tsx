import type { DeploymentPolicy } from '../../hooks/useApi';

function chipClass(active: boolean): string {
  const base = 'inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider border';
  return active
    ? `${base} border-emerald-500/30 bg-emerald-500/10 text-emerald-300`
    : `${base} border-zinc-700/60 bg-zinc-800/60 text-zinc-500`;
}

export default function PolicyCard({ policy }: { policy: DeploymentPolicy }) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-sm font-semibold text-zinc-100 capitalize">{policy.environment}</span>
        <span className="text-xs text-zinc-500 text-right leading-relaxed">
          {policy.required_review_approvals} reviews · {policy.required_manual_approvals} manual approvals
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className={chipClass(policy.require_protected_branch)}>
          protected branch {policy.require_protected_branch ? 'required' : 'not required'}
        </span>
        <span className={chipClass(policy.require_separation_of_duties)}>
          separation {policy.require_separation_of_duties ? 'required' : 'optional'}
        </span>
      </div>
    </div>
  );
}
