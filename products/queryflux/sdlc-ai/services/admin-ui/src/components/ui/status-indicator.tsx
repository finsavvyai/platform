'use client'

import { cn } from '@/lib/utils'
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react'

type Status = 'healthy' | 'degraded' | 'down' | 'active' | 'inactive' | 'warning' | 'error' | 'running' | 'stopped'

interface StatusIndicatorProps {
  status: Status
  label?: string
  size?: 'sm' | 'md'
  showIcon?: boolean
  className?: string
}

const statusColors: Record<Status, string> = {
  healthy: 'bg-emerald-500 dark:bg-emerald-400',
  active: 'bg-emerald-500 dark:bg-emerald-400',
  running: 'bg-emerald-500 dark:bg-emerald-400',
  degraded: 'bg-amber-500 dark:bg-amber-400',
  warning: 'bg-amber-500 dark:bg-amber-400',
  inactive: 'bg-muted-foreground',
  stopped: 'bg-muted-foreground',
  down: 'bg-destructive',
  error: 'bg-destructive',
}

const statusIcons: Record<Status, typeof CheckCircle> = {
  healthy: CheckCircle,
  active: CheckCircle,
  running: CheckCircle,
  degraded: AlertCircle,
  warning: AlertCircle,
  inactive: XCircle,
  stopped: XCircle,
  down: XCircle,
  error: XCircle,
}

const iconColors: Record<Status, string> = {
  healthy: 'text-emerald-500 dark:text-emerald-400',
  active: 'text-emerald-500 dark:text-emerald-400',
  running: 'text-emerald-500 dark:text-emerald-400',
  degraded: 'text-amber-500 dark:text-amber-400',
  warning: 'text-amber-500 dark:text-amber-400',
  inactive: 'text-muted-foreground',
  stopped: 'text-muted-foreground',
  down: 'text-destructive',
  error: 'text-destructive',
}

export function StatusIndicator({ status, label, size = 'sm', showIcon, className }: StatusIndicatorProps) {
  const dotSize = size === 'sm' ? 'h-2 w-2' : 'h-3 w-3'
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  if (showIcon) {
    const Icon = statusIcons[status]
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Icon className={cn(iconSize, iconColors[status])} />
        {label && <span className="text-sm">{label}</span>}
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('rounded-full', dotSize, statusColors[status])} />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}
