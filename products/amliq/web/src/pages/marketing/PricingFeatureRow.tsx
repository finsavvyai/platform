import { Check } from 'lucide-react'

interface PricingFeatureRowProps {
  label: string
  included: boolean
}

export default function PricingFeatureRow({ label, included }: PricingFeatureRowProps) {
  return (
    <div className={`flex items-center gap-3 py-2 text-sm ${included ? 'text-slate-600' : 'text-slate-600 line-through'}`}>
      {included ? <Check size={16} className="text-token-gold flex-shrink-0" /> : <div className="w-4 h-4 flex-shrink-0" />}
      {label}
    </div>
  )
}
