import { AlertTriangle } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { TYPE_ICONS } from '../../pages/TransactionMonitoring'

interface TxnAlert {
  id: string
  transaction_id: string
  alert_type: string
  severity: number
  description: string
  created_at: string
}

export function TxnAlertCard({ alert, typeLabels }: {
  alert: TxnAlert
  typeLabels: Record<string, string>
}) {
  const Icon = TYPE_ICONS[alert.alert_type] ?? AlertTriangle
  const time = new Date(alert.created_at).toLocaleString()

  return (
    <div className="glass-card p-md rounded-apple-md">
      <div className="flex items-start gap-md">
        <div className="flex-shrink-0 mt-0.5">
          <Icon className="w-5 h-5 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="sf-body font-medium mb-xs" style={{ color: 'var(--dash-text)' }}>
            {alert.description}
          </p>
          <div className="flex flex-wrap items-center gap-sm">
            <Badge size="sm" color="orange">
              {typeLabels[alert.alert_type] ?? alert.alert_type}
            </Badge>
            <span className="sf-caption" style={{ color: 'var(--dash-text-tertiary)' }}>
              TXN {alert.transaction_id}
            </span>
            <span className="sf-caption hidden sm:inline"
              style={{ color: 'var(--dash-text-tertiary)' }}>{time}</span>
          </div>
        </div>
        <SeverityBadge severity={alert.severity} />
      </div>
    </div>
  )
}

function SeverityBadge({ severity }: { severity: number }) {
  const color = severity >= 8
    ? 'bg-red-500/15 text-red-500'
    : severity >= 5
      ? 'bg-amber-500/15 text-amber-500'
      : 'bg-[rgba(201,169,110,0.15)] text-[#C9A96E]'
  return (
    <span className={`flex-shrink-0 px-sm py-xs text-xs font-semibold rounded-full ${color}`}>
      {severity}/10
    </span>
  )
}
