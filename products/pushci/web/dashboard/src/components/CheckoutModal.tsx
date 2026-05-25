import { useEffect, useRef, useState } from 'react';
import { btnGesturePrimary, btnGesture } from '../styles/gestures';
import { sanitizePromo } from '../lib/billing';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface PlanDef {
  id: string;
  name: string;
  price: string;
  period: string;
  features: string[];
  highlight?: boolean;
}

interface Props {
  plan: PlanDef;
  promoCode: string;
  onPromoChange: (code: string) => void;
  onConfirm: (promoCode: string) => void;
  onClose: () => void;
  pending?: boolean;
}

const SHIELD = (
  <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

export default function CheckoutModal({
  plan,
  promoCode,
  onPromoChange,
  onConfirm,
  onClose,
  pending = false,
}: Props) {
  const [localPromo, setLocalPromo] = useState(promoCode);
  const [showPromo, setShowPromo] = useState(!!promoCode);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isTeam = plan.id === 'team';
  const titleId = 'checkout-modal-title';
  const descId = 'checkout-modal-desc';

  useFocusTrap(dialogRef, { onEscape: pending ? undefined : onClose });

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  function handlePromoChange(v: string) {
    const cleaned = sanitizePromo(v);
    setLocalPromo(cleaned);
    onPromoChange(cleaned);
  }

  const gradientBorder = plan.highlight
    ? 'from-emerald-400/80 via-emerald-500/40 to-transparent'
    : isTeam ? 'from-violet-400/60 via-purple-500/30 to-transparent' : '';

  const btnClass = plan.highlight
    ? `bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_4px_24px_-4px_rgba(16,185,129,0.5)] ${btnGesturePrimary}`
    : `bg-violet-600 hover:bg-violet-500 text-white shadow-[0_4px_24px_-4px_rgba(139,92,246,0.4)] ${btnGesturePrimary}`;

  const checkColor = plan.highlight ? 'text-emerald-400' : isTeam ? 'text-violet-400' : 'text-emerald-400';
  const priceColor = plan.highlight ? 'text-emerald-300' : 'text-violet-300';

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current && !pending) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={`relative w-full max-w-md ${gradientBorder ? `p-px bg-gradient-to-b ${gradientBorder} rounded-2xl` : ''}`}
      >
        <div className={`rounded-2xl p-6 ${plan.highlight ? 'bg-[#0d1f18]' : isTeam ? 'bg-[#120e1f]' : 'bg-zinc-900'}`}>
          <div className="relative">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">
                  Confirm upgrade
                </p>
                <h2 id={titleId} className="text-xl font-bold text-white">
                  PushCI {plan.name}
                </h2>
                <div id={descId} className="flex items-baseline gap-1 mt-1">
                  <span className={`text-3xl font-black ${priceColor}`}>{plan.price}</span>
                  <span className="text-sm text-zinc-500">{plan.period}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                aria-label="Close checkout dialog"
                className="text-zinc-600 hover:text-zinc-400 transition-colors p-1 disabled:opacity-50"
              >
                <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <ul className="space-y-2 mb-5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
                  <svg aria-hidden="true" className={`w-4 h-4 mt-0.5 shrink-0 ${checkColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <div className="border-t border-zinc-800/80 pt-4 mb-5">
              {!showPromo ? (
                <button
                  type="button"
                  onClick={() => setShowPromo(true)}
                  className={`text-xs text-zinc-500 hover:text-zinc-300 transition-colors ${btnGesture}`}
                >
                  + Add promo code
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <label htmlFor="checkout-promo" className="sr-only">
                    Promo code
                  </label>
                  <input
                    id="checkout-promo"
                    autoFocus
                    type="text"
                    value={localPromo}
                    onChange={(e) => handlePromoChange(e.target.value)}
                    placeholder="PROMO CODE"
                    maxLength={32}
                    autoComplete="off"
                    spellCheck={false}
                    className="flex-1 rounded-lg border border-zinc-700/80 bg-black/40 px-3 py-2 text-xs font-mono text-white placeholder-zinc-600 focus:border-emerald-500/60 focus:outline-none tracking-widest"
                  />
                  {localPromo && (
                    <span aria-live="polite" className="text-xs text-emerald-400">
                      <span aria-hidden="true">✓ </span>Applied
                    </span>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onConfirm(localPromo)}
              disabled={pending}
              aria-busy={pending}
              className={`w-full py-3 rounded-xl text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70 ${btnClass}`}
            >
              {pending ? 'Opening checkout…' : 'Continue to payment'}
            </button>

            <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-zinc-600">
              <span className={`flex items-center gap-1 ${checkColor}`}>{SHIELD} Secure payment</span>
              <span aria-hidden="true">·</span>
              <span>14-day money-back guarantee</span>
              <span aria-hidden="true">·</span>
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
