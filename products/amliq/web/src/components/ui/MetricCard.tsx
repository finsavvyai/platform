import React from 'react'
import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  color?: 'blue' | 'green' | 'red' | 'orange' | 'teal'
  subtitle?: string
  className?: string
}

const iconBg: Record<string, string> = {
  blue: 'bg-[rgba(201,169,110,0.1)] text-[#C9A96E] dark:bg-[rgba(201,169,110,0.15)] dark:text-[#C9A96E]',
  green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  red: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
  orange: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  teal: 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400',
}

export function MetricCard({
  title, value, icon: Icon, color = 'blue', subtitle, className,
}: MetricCardProps) {
  return (
    <div className={clsx('card-vibrancy p-5', className)}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium uppercase tracking-wide"
          style={{ color: 'var(--dash-text-tertiary)' }}>{title}</p>
        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', iconBg[color])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <h3 className="text-2xl font-semibold tracking-tight mb-1"
        style={{ color: 'var(--dash-text)' }}>{value}</h3>
      {subtitle && (
        <p className="text-xs" style={{ color: 'var(--dash-text-tertiary)' }}>{subtitle}</p>
      )}
    </div>
  )
}
