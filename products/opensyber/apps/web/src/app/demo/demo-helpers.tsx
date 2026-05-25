import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function jitter(base: number, range: number): number {
  return clamp(base + (Math.random() - 0.5) * range, 0, 100);
}

export function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

export function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Fair';
  return 'Needs Attention';
}

export function strokeColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 50) return '#eab308';
  return '#ef4444';
}

export function SeverityIcon({ severity }: { severity: string }): React.ReactElement {
  switch (severity) {
    case 'critical':
    case 'high':
      return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
    case 'alert':
      return <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />;
    case 'warn':
    case 'medium':
      return <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />;
    case 'ok':
      return <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />;
    default:
      return <CheckCircle className="h-4 w-4 text-info shrink-0" />;
  }
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  alert: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  warn: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  info: 'bg-info/20 text-info border-info/30',
  ok: 'bg-green-500/20 text-green-400 border-green-500/30',
};

export function SeverityBadge({ severity }: { severity: string }): React.ReactElement {
  const cls = SEVERITY_STYLES[severity] ?? 'bg-green-500/20 text-green-400 border-green-500/30';
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${cls} uppercase`}>
      {severity}
    </span>
  );
}
