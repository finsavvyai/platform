import type { ReactNode } from 'react';

type BadgeVariant =
  | 'info'
  | 'warning'
  | 'critical'
  | 'success'
  | 'neutral'
  | 'blue';

const variantMap: Record<BadgeVariant, string> = {
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  success: 'bg-green-500/10 text-green-400 border-green-500/20',
  neutral: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

export function Badge({
  children,
  variant = 'neutral',
}: {
  children: ReactNode;
  variant?: BadgeVariant;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${variantMap[variant]}`}
    >
      {children}
    </span>
  );
}

const statusToVariant: Record<string, BadgeVariant> = {
  running: 'success',
  ready: 'success',
  approved: 'success',
  warning: 'warning',
  stopped: 'warning',
  pending: 'warning',
  scanning: 'warning',
  reviewing: 'warning',
  error: 'critical',
  critical: 'critical',
  revoked: 'critical',
  rejected: 'critical',
  info: 'info',
  provisioning: 'info',
  installing: 'info',
  destroying: 'neutral',
  suspended: 'neutral',
};

export function StatusBadge({ status }: { status: string }) {
  const variant = statusToVariant[status] ?? 'neutral';
  return <Badge variant={variant}>{status}</Badge>;
}
