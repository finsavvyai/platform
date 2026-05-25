import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { CaseTimeline } from '../components/compliance/CaseTimeline'
import { CaseActions } from '../components/compliance/CaseActions'
import { SimilarCasesCard } from '../components/cases/SimilarCasesCard'

interface CaseData {
  id: string
  entity_name: string
  matched_name: string
  status: string
  priority: string
  assigned_to: string
  confidence: number
  resolution: string
}

interface Comment {
  id: string
  content: string
  created_at: string
}

export function CaseDetail() {
  const { t } = useTranslation('compliance')
  const { id } = useParams<{ id: string }>()
  const [caseData, setCaseData] = useState<CaseData | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [validTransitions, setValidTransitions] = useState<string[]>([])

  const fetchCase = () => {
    api.get<{ case: CaseData; comments: Comment[] }>(`/cases/${id}`)
      .then(d => {
        setCaseData(d?.case ?? null)
        setComments(d?.comments ?? [])
      })
      .catch(() => setCaseData(null))
    api.get<{ valid_transitions: string[] }>(`/cases/${id}/timeline`)
      .then(d => setValidTransitions(d?.valid_transitions ?? []))
      .catch(() => {})
  }

  useEffect(() => { fetchCase() }, [id])

  if (!caseData) return <div className="p-lg" role="status" aria-live="polite">Loading...</div>

  return (
    <div className="px-md py-lg sm:p-8 max-w-4xl mx-auto">
      <h1 className="sf-title sf-title mb-2">{caseData.entity_name}</h1>
      <p className="mb-6 text-sm sm:text-base break-words"
        style={{ color: 'var(--dash-text-secondary)' }}>
        {t('case_detail.match')} {caseData.matched_name}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <InfoField label={t('case_detail.status')} value={caseData.status} />
        <InfoField label={t('case_detail.priority')} value={caseData.priority} />
        <InfoField label={t('case_detail.confidence')}
          value={`${(caseData.confidence * 100).toFixed(1)}%`} />
        <InfoField label={t('case_detail.assigned_to')}
          value={caseData.assigned_to || t('case_detail.unassigned')} />
      </div>
      <CaseActions caseId={id!} status={caseData.status}
        validTransitions={validTransitions} onAction={fetchCase} />
      <CaseTimeline caseId={id!} comments={comments} />
      <SimilarCasesCard />
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card p-md rounded-apple-md">
      <p className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>{label}</p>
      <p className="font-medium" style={{ color: 'var(--dash-text)' }}>{value}</p>
    </div>
  )
}
