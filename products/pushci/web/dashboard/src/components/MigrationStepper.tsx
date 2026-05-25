// Sidebar stepper for MigrationWizardPage.
import { STEPS } from '../pages/migrationWizardData';

export default function MigrationStepper({ step }: { step: number }): JSX.Element {
  return (
    <aside className="rounded-xl border border-surface-border bg-surface-card p-4 h-fit">
      <ol className="space-y-1">
        {STEPS.map((s) => {
          const isActive = step === s.id;
          const isComplete = step > s.id;
          const rowCls = isActive
            ? 'bg-accent/10 text-zinc-100 border border-accent/30'
            : isComplete ? 'text-emerald-400' : 'text-zinc-500';
          const dotCls = isActive
            ? 'border-accent text-emerald-400'
            : isComplete ? 'border-emerald-500/40 text-emerald-400' : 'border-surface-border text-zinc-500';
          return (
            <li key={s.id}>
              <div className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${rowCls}`}>
                <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-mono ${dotCls}`}>
                  {s.id}
                </span>
                <span>{s.label}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
