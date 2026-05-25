import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import UsageMeter from './UsageMeter'
import { UsageRecord } from '../../types/billing'
import { getUsage } from '../../api/billing'

export default function UsageOverview() {
  const { t } = useTranslation('billing')
  const [usage, setUsage] = useState<UsageRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getUsage('dashboard').then(setUsage).finally(() => setLoading(false))
  }, [])

  if (loading || !usage) return <div className="animate-pulse h-32 bg-white/5 rounded-apple-lg" />

  return (
    <div className="glass-card rounded-apple-lg p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1 sf-title">{t('usage.current_usage')}</h3>
        <p className="text-sm" style={{ color: 'var(--dash-text-secondary)' }}>{usage.product}</p>
      </div>
      {usage.metrics.map(m => (
        <UsageMeter key={m.name} label={m.name} current={m.current} max={m.limit} />
      ))}
      {usage.metrics.some(m => m.current > m.limit * 0.9) && (
        <div className="bg-[#C9A96E]/10 border border-[#C9A96E]/30 rounded-apple-md p-4">
          <p className="text-sm text-[#C9A96E]">{t('usage.warning', { percent: 90 })}</p>
        </div>
      )}
    </div>
  )
}
