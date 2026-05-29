'use client'

import { cn } from '@/lib/utils'

interface ProgressProps {
  value: number
  color?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showLabel?: boolean
}

const sizeClasses = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
}

export function Progress({ value, color = 'bg-primary', size = 'md', className, showLabel }: ProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value))

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('w-full rounded-full bg-muted', sizeClasses[size])}>
        <div
          className={cn('rounded-full transition-all duration-300', color, sizeClasses[size])}
          style={{ width: `${clampedValue}%` }}
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {clampedValue}%
        </span>
      )}
    </div>
  )
}
