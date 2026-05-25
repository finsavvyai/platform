import { Check, Loader2, ExternalLink } from 'lucide-react';

const STEPS = [
  'Container requested',
  'Setting up secure runtime',
  'Configuring gateway token',
  'Starting agent',
] as const;

interface ProvisioningStatusProps {
  phase: 'provisioning' | 'running';
  pollCount: number;
  onViewInstance: () => void;
}

export function ProvisioningStatus({ phase, pollCount, onViewInstance }: ProvisioningStatusProps) {
  if (phase === 'running') {
    return (
      <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-3 text-xs text-green-400">
        <div className="flex items-center gap-2 mb-2">
          <Check className="h-4 w-4" /> Instance deployed successfully!
        </div>
        <button
          onClick={onViewInstance}
          className="inline-flex items-center gap-1.5 text-xs text-green-300 hover:text-green-200 underline underline-offset-2 transition-colors"
        >
          <ExternalLink className="h-3 w-3" /> View your instance
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-info/30 bg-info/10 px-3 py-3">
      <div className="flex items-center gap-2 text-xs text-info mb-2">
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        <span className="font-medium">Provisioning your agent... (30–60s)</span>
      </div>
      {STEPS.map((label, i) => {
        const done = i === 0 || (i === 1 && pollCount > 3) || (i === 2 && pollCount > 6);
        return (
          <div key={label} className="flex items-center gap-2 text-xs">
            {done ? (
              <Check className="h-3 w-3 text-green-400" />
            ) : (
              <div className="h-3 w-3 rounded-full border border-neutral-600" />
            )}
            <span className={done ? 'text-green-400' : 'text-text-dim'}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
