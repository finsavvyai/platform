import React from 'react'
import { useTranslation } from 'react-i18next'

interface Props { current: number }

const STEP_KEYS = ['country', 'lists', 'threshold'] as const

export function StepIndicator({ current }: Props) {
  const { t } = useTranslation('onboarding')

  return (
    <div className="flex items-center justify-center gap-sm">
      {STEP_KEYS.map((key, i) => {
        const stepNum = i + 1
        const active = stepNum <= current
        return (
          <div key={key} className="flex items-center gap-xs">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center sf-caption font-medium ${
              active ? '' : ''
            }`}
            style={active ? { background: '#C9A96E', color: '#1A1814' } : { background: 'var(--dash-bg-tertiary)', color: 'var(--dash-text-secondary)' }}>
              {stepNum}
            </div>
            <span className="sf-caption" style={{ color: active ? 'var(--dash-text)' : 'var(--dash-text-secondary)' }}>
              {t(`steps.${key}`)}
            </span>
            {i < STEP_KEYS.length - 1 && (
              <div className="w-12 h-px"
                style={{ background: active ? '#C9A96E' : 'var(--dash-border)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
