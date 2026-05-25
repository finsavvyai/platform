const STEPS = ['Select Project', 'Configure', 'Review', 'Done'];

interface Props {
  current: number;
  total?: number;
}

export default function SkillBreadcrumbs({ current, total }: Props) {
  const steps = STEPS.slice(0, total || STEPS.length);
  return (
    <div className="flex items-center gap-1 mb-4">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-1">
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition-all ${
            i < current ? 'bg-emerald-500/20 text-emerald-400'
              : i === current ? 'bg-emerald-500 text-black'
              : 'bg-zinc-800 text-zinc-500'
          }`}>
            {i < current ? '\u2713' : i + 1}. {label}
          </span>
          {i < steps.length - 1 && <span className="text-zinc-600 text-xs">&rarr;</span>}
        </div>
      ))}
    </div>
  );
}
