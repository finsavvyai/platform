'use client';

type InstanceStatus =
  | 'provisioning'
  | 'installing'
  | 'ready'
  | 'running'
  | 'stopped'
  | 'error'
  | 'suspended'
  | 'destroying';

interface InstanceStatusBadgeProps {
  status: InstanceStatus;
}

const STATUS_CONFIG: Record<
  InstanceStatus,
  { label: string; color: string; dotColor: string }
> = {
  running: {
    label: 'Running',
    color: 'bg-green-500/10 text-green-400 border-green-500/20',
    dotColor: 'bg-green-400',
  },
  ready: {
    label: 'Ready',
    color: 'bg-green-500/10 text-green-400 border-green-500/20',
    dotColor: 'bg-green-400',
  },
  provisioning: {
    label: 'Provisioning',
    color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    dotColor: 'bg-yellow-400',
  },
  installing: {
    label: 'Installing',
    color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    dotColor: 'bg-yellow-400',
  },
  stopped: {
    label: 'Stopped',
    color: 'bg-neutral-500/10 text-text-secondary border-neutral-500/20',
    dotColor: 'bg-neutral-400',
  },
  error: {
    label: 'Error',
    color: 'bg-red-500/10 text-red-400 border-red-500/20',
    dotColor: 'bg-red-400',
  },
  suspended: {
    label: 'Suspended',
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    dotColor: 'bg-amber-400',
  },
  destroying: {
    label: 'Destroying',
    color: 'bg-red-500/10 text-red-400 border-red-500/20',
    dotColor: 'bg-red-400',
  },
};

export function InstanceStatusBadge({ status }: InstanceStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.error;
  const isPulsing = status === 'provisioning' || status === 'installing' || status === 'destroying';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${config.color}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${config.dotColor} ${isPulsing ? 'animate-pulse' : ''}`}
      />
      {config.label}
    </span>
  );
}
