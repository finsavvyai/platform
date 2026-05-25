import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { EmptyState } from '../components/ui/EmptyState'
import { api } from '../api/client'
import { CaseCard } from '../components/compliance/CaseListCard'

interface ComplianceCase {
  id: string
  entity_name: string
  matched_name: string
  status: string
  priority: string
  assigned_to: string
  created_at: string
}

export function CaseManagement() {
  const { t } = useTranslation('compliance')
  const [cases, setCases] = useState<ComplianceCase[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    const ep = filter ? `/cases?status=${filter}` : '/cases'
    api.get<{ cases: ComplianceCase[] }>(ep)
      .then(d => setCases(d?.cases ?? []))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed'))
      .finally(() => setLoading(false))
  }, [filter])

  const statuses = ['', 'open', 'in_review', 'escalated', 'resolved']

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title={t('cases.title')} description="Manage compliance investigation cases" />
      <div className="flex gap-sm mb-lg flex-wrap">
        {statuses.map(s => (
          <button key={s} onClick={() => setFilter(s)} aria-pressed={filter === s}
            className={`min-h-[44px] px-lg py-xs rounded-full text-sm cursor-pointer transition-colors ${
              filter === s
                ? 'text-[#FAFAF8]'
                : 'bg-white/[0.04] hover:bg-white/[0.08]'
            }`}
            style={filter === s ? { background: '#1A1814', color: '#FAFAF8' } : { color: 'var(--dash-text-secondary)' }}>
            {s ? t(`cases.${s}`) : t('cases.all')}
          </button>
        ))}
      </div>

      {error && <Card className="mb-lg"><p role="alert" className="text-red-500 sf-body">{error}</p></Card>}
      {loading && <LoadingSpinner />}
      {!loading && cases.length === 0 && <EmptyState title={t('cases.no_cases')} />}

      {!loading && cases.length > 0 && (
        <div className="space-y-sm">
          {cases.map(c => <CaseCard key={c.id} caseItem={c} t={t} />)}
        </div>
      )}
    </div>
  )
}
