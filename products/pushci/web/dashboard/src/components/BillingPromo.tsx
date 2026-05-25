import { useState } from 'react';

interface BillingPromoProps {
  promoCode: string;
  onPromoChange: (code: string) => void;
}

export default function BillingPromo({ promoCode, onPromoChange }: BillingPromoProps) {
  const [expanded, setExpanded] = useState(!!promoCode);

  return (
    <div className="mb-8 flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-5 5a2 2 0 01-2.828 0l-7-7A2 2 0 013 10V5a2 2 0 012-2z" />
        </svg>
        Have a promo code?
      </div>
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 border border-emerald-500/25 hover:border-emerald-500/50 bg-emerald-500/5 hover:bg-emerald-500/10 px-3 py-1.5 rounded-full transition-all duration-150"
        >
          Enter code
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => onPromoChange(e.target.value.toUpperCase())}
            placeholder="PROMO CODE"
            autoFocus
            className="rounded-lg border border-zinc-700/80 bg-zinc-900 px-3 py-1.5 text-xs font-mono text-white placeholder-zinc-600 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 w-40 tracking-widest"
          />
          {promoCode && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              Applied at checkout
            </span>
          )}
        </div>
      )}
    </div>
  );
}
