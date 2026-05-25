import clsx from 'clsx'

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
type Size = 'sm' | 'md' | 'lg'

interface SeverityBadgeProps {
  severity: Severity
  size?: Size
  className?: string
}

const config: Record<Severity, { gradient: string; dot: string; border: string; text: string }> = {
  critical: {
    gradient: 'bg-gradient-to-r from-red-500/20 to-rose-500/10',
    dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]',
    border: 'border-red-500/30', text: 'text-red-400',
  },
  high: {
    gradient: 'bg-gradient-to-r from-orange-500/20 to-amber-500/10',
    dot: 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]',
    border: 'border-orange-500/30', text: 'text-orange-400',
  },
  medium: {
    gradient: 'bg-gradient-to-r from-yellow-500/20 to-amber-400/10',
    dot: 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]',
    border: 'border-yellow-500/30', text: 'text-yellow-400',
  },
  low: {
    gradient: 'bg-gradient-to-r from-green-500/20 to-emerald-400/10',
    dot: 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]',
    border: 'border-green-500/30', text: 'text-green-400',
  },
  info: {
    gradient: 'bg-gradient-to-r from-[rgba(201,169,110,0.2)] to-[rgba(201,169,110,0.05)]',
    dot: 'bg-[#C9A96E] shadow-[0_0_8px_rgba(201,169,110,0.6)]',
    border: 'border-[rgba(201,169,110,0.3)]', text: 'text-[#C9A96E]',
  },
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-[11px]',
  lg: 'px-3 py-1.5 text-xs',
}

export function SeverityBadge({ severity, size = 'md', className }: SeverityBadgeProps) {
  const c = config[severity]
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wider border',
      c.gradient, c.border, c.text, sizeClasses[size], className,
    )}>
      <span className={clsx('w-1.5 h-1.5 rounded-full animate-pulse', c.dot)} />
      {severity}
    </span>
  )
}
