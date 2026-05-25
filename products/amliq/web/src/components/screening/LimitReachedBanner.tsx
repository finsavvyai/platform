import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Lock } from 'lucide-react'
import { ApiError } from '../../api/client'
import { screeningApi, ScreeningQuota } from '../../api/screening'

interface Props {
  error: Error
}

export function LimitReachedBanner({ error }: Props) {
  const navigate = useNavigate()
  const code = error instanceof ApiError ? error.code : ''
  const isFreeTier = code === 'FREE_TIER_EXHAUSTED'
  const [quota, setQuota] = useState<ScreeningQuota | null>(null)

  useEffect(() => {
    screeningApi.getQuota().then(setQuota).catch(() => setQuota(null))
  }, [])

  const limitLabel = quota && quota.limit > 0
    ? `${quota.used.toLocaleString()} / ${quota.limit.toLocaleString()}`
    : null

  const message = isFreeTier
    ? limitLabel
      ? `You've used all ${limitLabel} free screenings this month. Subscribe to a plan to continue screening entities.`
      : "You've hit this month's free screening quota. Subscribe to a plan to continue screening entities."
    : limitLabel
      ? `You've used ${limitLabel} screenings in your current plan. Upgrade to unlock more capacity.`
      : "You've used all screenings included in your current plan. Upgrade to unlock more capacity."

  return (
    <div className="max-w-2xl mx-auto mt-xl" role="alert">
      <div
        className="relative overflow-hidden rounded-apple-lg"
        style={{
          background: 'var(--bg-elevated)',
          border: '1.5px solid var(--accent-gold)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, var(--accent-gold-light) 0%, transparent 70%)' }}
        />

        <div className="relative p-xl text-center">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-lg"
            style={{ background: 'var(--accent-gold-light)', border: '1.5px solid var(--accent-gold)' }}
          >
            <Lock className="w-6 h-6" style={{ color: 'var(--accent-gold)' }} />
          </div>

          <h3 className="text-lg font-bold mb-sm" style={{ color: 'var(--text)' }}>
            {isFreeTier ? 'Free tier limit reached' : 'Screening limit reached'}
          </h3>
          <p className="text-sm mb-xl max-w-sm mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {message}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-sm">
            <button
              type="button"
              onClick={() => navigate('/billing')}
              className="inline-flex items-center gap-sm px-6 py-2.5 text-sm font-semibold rounded-apple transition-all cursor-pointer hover:opacity-90 active:scale-95"
              style={{ background: 'var(--accent-gold)', color: '#1A1814' }}
            >
              <TrendingUp className="w-4 h-4" />
              {isFreeTier ? 'View Plans' : 'Upgrade Plan'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/billing')}
              className="text-sm cursor-pointer hover:underline transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Compare all plans
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
