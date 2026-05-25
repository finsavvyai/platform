import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArrowUpRight, Shield, Clock } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Badge } from '../components/ui/Badge'
import { api } from '../api/client'
import { WebhookCTA } from '../components/transactions/WebhookCTA'
import { TxnSummaryCards } from '../components/transactions/TxnSummaryCards'
import { TxnAlertCard } from '../components/transactions/TxnAlertCard'

interface TxnAlert {
  id: string
  transaction_id: string
  alert_type: string
  severity: number
  description: string
  created_at: string
}

export const TYPE_ICONS: Record<string, typeof AlertTriangle> = {
  high_value: ArrowUpRight, rapid_movement: Clock,
  structuring: Shield, high_risk_country: AlertTriangle,
  unusual_pattern: AlertTriangle,
}

export function TransactionMonitoring() {
  const { t } = useTranslation('compliance')
  const [alerts, setAlerts] = useState<TxnAlert[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<{ alerts: TxnAlert[] }>('/transactions/alerts')
        .then(d => setAlerts(d?.alerts ?? [])).catch(() => setAlerts([])),
      api.get<Record<string, number>>('/transactions/alerts/summary')
        .then(d => setSummary(d ?? {})).catch(() => setSummary({})),
    ]).finally(() => setLoading(false))
  }, [])

  const typeLabels: Record<string, string> = {
    high_value: t('transactions.high_value'),
    rapid_movement: t('transactions.rapid_movement'),
    structuring: t('transactions.structuring'),
    high_risk_country: t('transactions.high_risk_country'),
    unusual_pattern: t('transactions.unusual_pattern'),
  }

  if (loading) return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>

  return (
    <div>
      <PageHeader
        title={t('transactions.title')}
        description="Real-time screening of every customer transaction against sanctions, PEP, and adverse-media lists. Bulk-import historical transactions as CSV, or connect your payment processor / core banking system via webhook so each new transaction is screened automatically the moment it is created."
      />
      <TxnSummaryCards summary={summary} typeLabels={typeLabels} />
      <h2 className="sf-headline mb-md">{t('transactions.recent_alerts')}</h2>
      <div className="space-y-sm">
        {alerts.map(a => <TxnAlertCard key={a.id} alert={a} typeLabels={typeLabels} />)}
        {alerts.length === 0 && <WebhookCTA />}
      </div>
    </div>
  )
}
