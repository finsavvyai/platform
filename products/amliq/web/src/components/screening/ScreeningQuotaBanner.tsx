import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpCircle } from 'lucide-react'
import { screeningApi, ScreeningQuota } from '../../api/screening'

interface Props {
  refreshKey?: number | string
}

export function ScreeningQuotaBanner({ refreshKey }: Props = {}) {
  const navigate = useNavigate()
  const [quota, setQuota] = useState<ScreeningQuota | null>(null)

  useEffect(() => {
    screeningApi.getQuota().then(setQuota).catch(() => null)
  }, [refreshKey])

  if (!quota) return null

  // Unlimited plan or no enforcer
  if (quota.limit < 0) return null

  const pct = quota.limit > 0 ? (quota.used / quota.limit) * 100 : 0
  const isLow = pct >= 80
  const isExhausted = quota.remaining <= 0

  const barColor = isExhausted
    ? 'bg-apple-red'
    : isLow
      ? 'bg-amber-500'
      : 'bg-apple-green'

  const borderColor = isExhausted
    ? 'border-apple-red/20'
    : isLow
      ? 'border-amber-500/20'
      : ''

  return (
    <div className={`rounded-apple-md border ${borderColor} px-lg py-md`} style={{ background: 'var(--dash-surface)', borderColor: borderColor ? undefined : 'var(--dash-border)' }}>
      <div className="flex items-center justify-between mb-xs">
        <span className="text-xs text-apple-label-secondary">
          {quota.used.toLocaleString()} / {quota.limit.toLocaleString()} screenings used
        </span>
        {isExhausted ? (
          <button onClick={() => navigate('/billing')}
            className="text-xs hover:underline cursor-pointer font-medium"
            style={{ color: '#C9A96E' }}>
            Upgrade Plan
          </button>
        ) : isLow ? (
          <span className="text-xs text-amber-400">
            {quota.remaining.toLocaleString()} remaining
          </span>
        ) : (
          <span className="text-xs text-apple-label-tertiary">
            {quota.remaining.toLocaleString()} remaining
          </span>
        )}
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--dash-surface)' }}>
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  )
}
