import React from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  value: number
  onChange: (v: number) => void
  onFinish: () => void
  saving: boolean
}

export function ThresholdStep({ value, onChange, onFinish, saving }: Props) {
  const { t } = useTranslation('onboarding')

  return (
    <div className="glass-card rounded-apple-lg p-lg space-y-md">
      <h2 className="sf-body font-medium sf-title">{t('threshold.title')}</h2>
      <p className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>
        {t('threshold.description')}
      </p>
      <div className="space-y-sm">
        <div className="flex justify-between sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>
          <span>{t('threshold.low')}</span>
          <span>{t('threshold.current')} {value}%</span>
          <span>{t('threshold.high')}</span>
        </div>
        <input
          type="range" min={50} max={95} step={5} value={value}
          aria-valuetext={`${value}%`} aria-label={t('threshold.title')}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full accent-[#C9A96E]"
        />
        <p className="sf-caption text-center" style={{ color: 'var(--dash-text-secondary)' }}>
          {value < 65 ? t('threshold.hint_more') :
           value > 85 ? t('threshold.hint_fewer') :
           t('threshold.hint_balanced')}
        </p>
      </div>
      <button onClick={onFinish} disabled={saving}
        className="button-primary w-full text-center disabled:opacity-50">
        {saving ? t('threshold.starting') : t('threshold.start')}
      </button>
    </div>
  )
}
