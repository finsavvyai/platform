import { useTranslation } from 'react-i18next'
import { Layers, Globe, Zap, ShieldCheck } from 'lucide-react'

const statIcons = [
  <Layers size={20} />,
  <Globe size={20} />,
  <Zap size={20} />,
  <ShieldCheck size={20} />,
]

export default function StatsSection() {
  const { t } = useTranslation('marketing')

  const stats = [
    { label: t('stats.screened_daily'), value: t('stats.screened_value') },
    { label: t('stats.uptime'), value: t('stats.uptime_value') },
    { label: t('stats.fewer_fp'), value: t('stats.fewer_fp_value') },
    { label: t('stats.latency'), value: t('stats.latency_value') },
  ]

  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <div key={i}
              className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center group hover:border-token-gold/30 transition-all cursor-default">
              <div className="flex justify-center mb-3 text-token-gold">
                {statIcons[i]}
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-slate-900 mb-1 tracking-tight">
                {stat.value}
              </p>
              <p className="text-xs text-slate-600">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
