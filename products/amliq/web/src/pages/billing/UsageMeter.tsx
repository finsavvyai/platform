import React from 'react'

interface UsageMeterProps { label: string; current: number; max: number }

export default function UsageMeter({ label, current, max }: UsageMeterProps) {
  const percentage = (current / max) * 100
  const color = percentage < 80
    ? 'bg-apple-green' : percentage < 95
    ? 'bg-[#1A1814]' : 'bg-red-600'

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium" style={{ color: 'var(--dash-text-secondary)' }}>{label}</label>
        <span className="text-xs" style={{ color: 'var(--dash-text-tertiary)' }}>
          {current.toLocaleString()} / {max.toLocaleString()} ({percentage.toFixed(1)}%)
        </span>
      </div>
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${Math.min(percentage, 100)}%` }} />
      </div>
    </div>
  )
}
