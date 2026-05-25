import { useTranslation } from 'react-i18next'
import { Star } from 'lucide-react'

export function BundleCallout() {
  const { t } = useTranslation('marketing')

  return (
    <div className="rounded-xl p-6 mx-auto max-w-2xl" style={{ background: 'color-mix(in srgb, var(--accent-gold) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-gold) 20%, transparent)' }}>
      <div className="flex items-start gap-3">
        <Star className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-gold)' }} />
        <div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">{t('bundle.title')}</h3>
          <p className="text-sm text-slate-600 mb-4">{t('bundle.description')}</p>
          <button type="button"
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:-translate-y-px cursor-pointer min-h-[44px]"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text)' }}>
            {t('bundle.cta')}
          </button>
        </div>
      </div>
    </div>
  )
}
