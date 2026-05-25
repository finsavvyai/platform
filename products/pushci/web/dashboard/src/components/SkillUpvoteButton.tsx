// Upvote toggle button with a subtle scale animation and accent color when active.
import { useState } from 'react';

export default function SkillUpvoteButton({
  count, active = false, disabled = false, onToggle,
}: {
  count: number; active?: boolean; disabled?: boolean;
  onToggle: () => Promise<void> | void;
}): JSX.Element {
  const [pending, setPending] = useState(false);
  const [bump, setBump] = useState(false);

  const handleClick = async () => {
    if (disabled || pending) return;
    setPending(true); setBump(true);
    setTimeout(() => setBump(false), 180);
    try { await onToggle(); } finally { setPending(false); }
  };

  const activeCls = active
    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
    : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600';

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`Upvote skill (${count} upvotes)`}
      onClick={handleClick}
      disabled={disabled || pending}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-60 ${activeCls} ${bump ? 'scale-105' : 'scale-100'}`}
    >
      <span aria-hidden="true" className="text-sm leading-none">{active ? '▲' : '△'}</span>
      <span className="font-mono tabular-nums" data-testid="upvote-count">{count}</span>
    </button>
  );
}
