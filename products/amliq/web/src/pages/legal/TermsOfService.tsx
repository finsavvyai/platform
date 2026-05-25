import React from 'react'
import { useTranslation } from 'react-i18next'

export default function TermsOfService() {
  const { t } = useTranslation('legal')
  const sections = t('terms.sections', { returnObjects: true }) as Array<{
    title: string; body: string
  }>

  return (
    <article className="max-w-3xl mx-auto px-6 py-20">
      <h1 className="text-4xl font-bold mb-2 sf-title">{t('terms.title')}</h1>
      <p className="text-sm mb-12" style={{ color: 'var(--dash-text-secondary)' }}>{t('terms.last_updated')}</p>

      <div className="space-y-8 leading-relaxed" style={{ color: 'var(--dash-text-secondary)' }}>
        {sections.map((section, i) => (
          <section key={i} className="glass-card rounded-apple-lg p-lg">
            <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--dash-text)' }}>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>
    </article>
  )
}
