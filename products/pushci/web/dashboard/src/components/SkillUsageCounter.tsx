// Usage counter pill. Muted when <100 uses, accent when >1k.
import { fmt } from './skills/types';

export default function SkillUsageCounter({
  count, label = 'uses',
}: { count: number; label?: string }): JSX.Element {
  const muted = count < 100;
  const hot = count >= 1000;
  const cls = hot
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : muted
      ? 'bg-zinc-800 text-zinc-500 border-zinc-700/50'
      : 'bg-zinc-800 text-zinc-300 border-zinc-700/50';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}
      aria-label={`${count} ${label}`}
      data-testid="skill-usage-counter"
    >
      <span className="font-mono">{fmt(count)}</span>
      <span className="text-[10px] opacity-80">{label}</span>
    </span>
  );
}
