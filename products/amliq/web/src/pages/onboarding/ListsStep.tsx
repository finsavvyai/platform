import React from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2 } from 'lucide-react'

interface ListSuggestion { list_id: string; threshold: number; sync_enabled: boolean }
interface Props { lists: ListSuggestion[]; onNext: () => void }

export function ListsStep({ lists, onNext }: Props) {
  const { t } = useTranslation('onboarding')

  return (
    <div className="glass-card rounded-apple-lg p-lg space-y-md">
      <h2 className="sf-body font-medium sf-title">{t('lists.title')}</h2>
      <p className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>
        {t('lists.description')}
      </p>
      <div className="space-y-sm">
        {lists.map(l => (
          <div key={l.list_id} className="flex items-center gap-sm p-md rounded-apple-md border"
            style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-surface)' }}>
            <CheckCircle2 className="w-5 h-5 text-apple-green shrink-0" />
            <div className="flex-1">
              <span className="sf-body uppercase" style={{ color: 'var(--dash-text)' }}>{l.list_id}</span>
              <span className="sf-caption block" style={{ color: 'var(--dash-text-secondary)' }}>
                {t('lists.threshold')} {(l.threshold * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
      {lists.length === 0 && (
        <p className="sf-caption text-center py-md" style={{ color: 'var(--dash-text-secondary)' }}>
          {t('lists.loading')}
        </p>
      )}
      <button onClick={onNext} disabled={lists.length === 0}
        className="button-primary w-full text-center disabled:opacity-50">
        {t('continue')}
      </button>
    </div>
  )
}
