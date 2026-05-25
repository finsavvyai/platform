import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ProductType } from '../../types/billing'
import { getUsage } from '../../api/billing'

interface ProductUsageProps { product: ProductType }

export function ProductUsage({ product }: ProductUsageProps) {
  const { t } = useTranslation('billing')
  const [usage, setUsage] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getUsage(product)
      .then(data => setUsage(data))
      .catch(() => setUsage(null))
      .finally(() => setLoading(false))
  }, [product])

  if (loading) return <div className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>{t('usage.loading')}</div>
  if (!usage) return <div className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>{t('usage.no_data')}</div>

  return (
    <div className="space-y-md">
      {(usage.metrics ?? []).map((metric: any) => (
        <div key={metric.name}>
          <div className="flex justify-between mb-xs">
            <span className="sf-body" style={{ color: 'var(--dash-text)' }}>{metric.name}</span>
            <span className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>
              {metric.current}/{metric.limit} {metric.unit}
            </span>
          </div>
          <div className="w-full h-2 rounded-apple-md overflow-hidden" style={{ background: 'var(--dash-bg-tertiary)' }}>
            <div className="h-full bg-gradient-to-r from-[#C9A96E] to-indigo-600 transition-all"
              style={{ width: `${Math.min((metric.current / metric.limit) * 100, 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
