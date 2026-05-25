import { ReactNode } from 'react'

interface FeatureDetailProps {
  icon: ReactNode
  title: string
  description: string
}

export default function FeatureDetail({ icon, title, description }: FeatureDetailProps) {
  return (
    <div className="p-6 rounded-xl bg-slate-50 hover:bg-slate-50/80 border border-slate-200 hover:border-token-gold/30 transition-all">
      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#C9A96E] to-[#C9A96E]-dark flex items-center justify-center mb-4 text-[#0F172A]">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600">{description}</p>
    </div>
  )
}
