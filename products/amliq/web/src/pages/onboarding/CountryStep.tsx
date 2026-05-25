import React from 'react'
import { useTranslation } from 'react-i18next'

interface Country { code: string; label: string }
interface Props {
  countries: Country[]
  value: string
  onChange: (code: string) => void
}

export function CountryStep({ countries, value, onChange }: Props) {
  const { t } = useTranslation('onboarding')

  return (
    <div className="glass-card rounded-apple-lg p-lg space-y-md">
      <h2 className="sf-body font-medium sf-title">{t('country.title')}</h2>
      <p className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>
        {t('country.description')}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
        {countries.map(c => (
          <button
            key={c.code}
            onClick={() => onChange(c.code)}
            className={`p-md rounded-apple-md border text-left transition-colors min-h-[44px] ${
              value === c.code ? '' : ''
            }`}
            style={value === c.code
              ? { borderColor: '#C9A96E', background: 'rgba(201,169,110,0.08)', color: 'var(--dash-text)' }
              : { borderColor: 'var(--dash-border)', background: 'var(--dash-surface)', color: 'var(--dash-text-secondary)' }}
          >
            <span className="sf-body font-medium">{c.label}</span>
            <span className="sf-caption block mt-xs">{c.code}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
