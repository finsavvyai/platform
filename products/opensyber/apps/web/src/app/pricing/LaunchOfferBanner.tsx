'use client';

import { useEffect, useMemo, useState } from 'react';
import { Timer } from 'lucide-react';

export interface LaunchOfferBannerProps {
  /** Deal expiry as ISO string */
  expiresAt: string;
  /** Promo code to show */
  code?: string;
  /** Discount percentage */
  discountPercent?: number;
  /** Override current time — for tests only */
  now?: Date;
}

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function computeCountdown(target: Date, now: Date): Countdown {
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  return { days, hours, minutes, seconds, expired: false };
}

/**
 * Launch-window urgency banner shown above pricing cards.
 * Honest scarcity: a real expiry, a real code, no fake urgency loops.
 */
export function LaunchOfferBanner({
  expiresAt,
  code = 'LAUNCH40',
  discountPercent = 40,
  now,
}: LaunchOfferBannerProps) {
  const target = useMemo(() => new Date(expiresAt), [expiresAt]);
  const initial = computeCountdown(target, now ?? new Date());
  const [countdown, setCountdown] = useState<Countdown>(initial);

  useEffect(() => {
    if (now) return; // test mode — don't tick
    const tick = () => setCountdown(computeCountdown(target, new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [now, target]);

  if (countdown.expired) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-10 mx-auto max-w-4xl rounded border border-signal/40 bg-signal/[0.06] px-6 py-4"
      data-testid="launch-offer-banner"
    >
      <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-5 text-center md:text-left">
        <div className="flex h-9 w-9 items-center justify-center rounded bg-signal/15 border border-signal/30">
          <Timer className="h-4 w-4 text-signal" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">
            Launch week: <span className="text-signal">{discountPercent}% off</span> annual plans
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            Code <span className="font-[family-name:var(--font-mono)] text-signal">{code}</span> at
            checkout. Ends in{' '}
            <span className="font-[family-name:var(--font-mono)] text-text-primary" data-testid="countdown">
              {countdown.days}d {countdown.hours}h {countdown.minutes}m {countdown.seconds}s
            </span>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
