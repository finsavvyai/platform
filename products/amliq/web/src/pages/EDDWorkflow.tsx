import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'

interface EDDReport {
  id: string
  entity_name: string
  status: string
  checklist: Record<string, boolean>
  risk_level: string
  notes: string
}

const checkKeys: Record<string, string> = {
  identity_verified: 'edd.identity',
  source_of_funds: 'edd.source_of_funds',
  source_of_wealth: 'edd.source_of_wealth',
  pep_screening: 'edd.pep_screening',
  adverse_media_check: 'edd.adverse_media',
  sanctions_screening: 'edd.sanctions',
  ubo_verification: 'edd.ubo_verification',
  country_risk_assessment: 'edd.country_risk',
}

export function EDDWorkflow() {
  const { t } = useTranslation('compliance')
  const { id } = useParams<{ id: string }>()
  const [report, setReport] = useState<EDDReport | null>(null)

  useEffect(() => {
    if (!id) return
    api.get<EDDReport>(`/edd/${id}`)
      .then(d => setReport(d ?? null))
      .catch(() => setReport(null))
  }, [id])

  if (!report) return <div className="p-lg" role="status" aria-live="polite">Loading...</div>

  const completed = Object.values(report.checklist).filter(Boolean).length
  const total = Object.keys(report.checklist).length
  const progress = total > 0 ? (completed / total) * 100 : 0

  return (
    <div className="px-md py-lg sm:p-8 max-w-4xl mx-auto">
      <h1 className="sf-title sf-title mb-2">{t('edd.title')}</h1>
      <p className="mb-6" style={{ color: 'var(--dash-text-secondary)' }}>{report.entity_name}</p>
      <div className="glass-card p-6 rounded-apple-lg">
        <div className="flex justify-between mb-2 text-sm">
          <span>{t('edd.progress')}</span>
          <span>{completed}/{total} {t('edd.checks')}</span>
        </div>
        <div className="w-full rounded-full h-2 mb-6" style={{ background: 'var(--dash-surface)' }}>
          <div className="h-2 rounded-full bg-gradient-to-r from-[#C9A96E] to-emerald-500"
            style={{ width: `${progress}%` }} />
        </div>
        <div className="space-y-3">
          {Object.entries(report.checklist).map(([key, done]) => (
            <div key={key} className="flex items-center gap-3 min-h-[44px]">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                done ? 'bg-emerald-500 border-emerald-500' : ''}`}
                style={done ? undefined : { borderColor: 'var(--dash-text-tertiary)' }}>
                {done && <span className="text-white text-xs">&#10003;</span>}
              </div>
              <span className={done ? 'line-through' : ''}
                style={done ? { color: 'var(--dash-text-tertiary)' } : undefined}>
                {checkKeys[key] ? t(checkKeys[key]) : key}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
