import { AlertTriangle } from 'lucide-react'
import { TYPE_ICONS } from '../../pages/TransactionMonitoring'

export function TxnSummaryCards({ summary, typeLabels }: {
  summary: Record<string, number>
  typeLabels: Record<string, string>
}) {
  const entries = Object.entries(summary)
  if (entries.length === 0) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-sm mb-xl">
      {entries.map(([type_, count]) => {
        const Icon = TYPE_ICONS[type_] ?? AlertTriangle
        return (
          <div key={type_} className="glass-card p-md rounded-apple-md">
            <div className="flex items-center gap-xs mb-xs">
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--dash-gold)' }} />
              <p className="sf-caption truncate"
                style={{ color: 'var(--dash-text-secondary)' }}>
                {typeLabels[type_] || type_}
              </p>
            </div>
            <p className="text-2xl font-bold">{count}</p>
          </div>
        )
      })}
    </div>
  )
}
