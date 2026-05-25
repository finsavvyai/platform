import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'

interface UsagePoint { month: string; screenings: number }

export default function UsageHistory() {
  const { t } = useTranslation('billing')
  const [history, setHistory] = useState<UsagePoint[]>([])

  useEffect(() => {
    api.get<UsagePoint[]>('/billing/usage/history')
      .then(data => setHistory(Array.isArray(data) ? data : []))
      .catch(() => setHistory([]))
  }, [])

  const maxScreenings = Math.max(...history.map(h => h.screenings), 1)

  return (
    <div className="glass-card rounded-apple-lg p-lg">
      <h3 className="sf-body font-medium mb-lg" style={{ color: 'var(--dash-text)' }}>
        {t('usage.history_title')}
      </h3>
      <div className="h-64 flex items-end justify-between gap-sm">
        {history.map((point, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-sm">
            <div className="w-full h-64 flex flex-col items-center justify-end">
              <div className="w-full bg-gradient-to-t from-[#C9A96E] to-indigo-600 rounded-t-apple-md"
                style={{ height: `${(point.screenings / maxScreenings) * 100}%` }}
                title={`${point.screenings} screenings`} />
            </div>
            <span className="sf-caption text-xs">{point.month}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
