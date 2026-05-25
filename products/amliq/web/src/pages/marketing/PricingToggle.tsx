interface Props { annual: boolean; onChange: (v: boolean) => void }

export default function PricingToggle({ annual, onChange }: Props) {
  return (
    <div className="flex items-center justify-center gap-4">
      <span className={`text-sm ${annual ? 'text-slate-600' : 'text-slate-900'}`}>
        Monthly
      </span>
      <button type="button" onClick={() => onChange(!annual)}
        className={`relative w-[51px] h-[31px] rounded-full cursor-pointer transition-colors duration-300 min-h-[44px] min-w-[51px] flex items-center ${
          annual ? 'bg-token-surface' : 'bg-slate-300'
        }`}>
        <div
          className="absolute w-[27px] h-[27px] rounded-full bg-white shadow-sm transition-all duration-200"
          style={{ top: '2px', left: annual ? '22px' : '2px' }} />
      </button>
      <span className={`text-sm ${annual ? 'text-slate-900' : 'text-slate-600'}`}>
        Annual
      </span>
      {annual && (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-token-gold/8 text-token-gold">
          Save 20%
        </span>
      )}
    </div>
  )
}
