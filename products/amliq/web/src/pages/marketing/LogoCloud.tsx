import { useTranslation } from 'react-i18next'
import { Building2, Landmark, Shield, Globe, Scale, Wallet } from 'lucide-react'

export default function LogoCloud() {
  const { t } = useTranslation('marketing')
  const segments = [
    { icon: <Landmark size={20} />, label: t('logo_cloud.banks') },
    { icon: <Shield size={20} />, label: t('logo_cloud.fintechs') },
    { icon: <Building2 size={20} />, label: t('logo_cloud.msbs') },
    { icon: <Globe size={20} />, label: t('logo_cloud.neobanks') },
    { icon: <Scale size={20} />, label: t('logo_cloud.regulators') },
    { icon: <Wallet size={20} />, label: t('logo_cloud.payments') },
  ]

  return (
    <section className="py-16 border-y border-slate-200">
      <div className="max-w-7xl mx-auto px-4">
        <p className="text-center text-sm text-slate-600 mb-12">{t('logo_cloud.subtitle')}</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {segments.map(s => (
            <div key={s.label}
              className="flex items-center justify-center gap-2 p-4 border border-slate-200 rounded-xl hover:border-token-gold/30 transition-colors min-h-[44px]">
              <span className="text-token-gold/60">{s.icon}</span>
              <span className="text-sm text-slate-600">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
