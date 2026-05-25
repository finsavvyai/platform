import { useTranslation } from 'react-i18next'
import { Phone } from 'lucide-react'

export default function EnterpriseCTA() {
  const { t } = useTranslation('marketing')

  return (
    <div className="bg-gradient-to-r from-indigo-600/20 to-[#C9A96E]/10 border border-indigo-600/30 rounded-xl p-8 text-center">
      <h3 className="text-2xl font-bold text-slate-900 mb-2">{t('enterprise.heading')}</h3>
      <p className="text-slate-600 mb-6">{t('enterprise.description')}</p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
        <button type="button"
          className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-indigo-600-dark text-white font-medium rounded-lg transition-all hover:shadow-lg hover:shadow-indigo-600/25 min-h-[44px] cursor-pointer">
          {t('enterprise.cta')}
        </button>
        <a href="tel:+1234567890"
          className="px-8 py-3 border border-slate-200 hover:border-token-gold/30 text-slate-900 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[44px]">
          <Phone size={16} />
          (855) 924-3447
        </a>
      </div>

      <p className="text-sm text-slate-600">{t('enterprise.note')}</p>
    </div>
  )
}
