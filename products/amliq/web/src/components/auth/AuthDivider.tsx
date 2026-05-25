import React from 'react'
import { useTranslation } from 'react-i18next'

export default function AuthDivider() {
  const { t } = useTranslation('auth')
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full" style={{ borderTop: '1px solid rgba(250,250,248,0.08)' }} />
      </div>
      <div className="relative flex justify-center text-xs uppercase tracking-[0.18em]">
        <span className="px-4" style={{ background: '#0A0908', color: 'rgba(250,250,248,0.4)' }}>
          {t('oauth.or_continue_email')}
        </span>
      </div>
    </div>
  )
}
