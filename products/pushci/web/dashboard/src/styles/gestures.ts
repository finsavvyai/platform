/** Shared gesture classes for interactive elements */

/** Standard button — subtle scale + shadow on hover, spring-back on press */
export const btnGesture =
  'transition-all duration-150 ease-out hover:scale-[1.02] active:scale-[0.97] hover:shadow-lg focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-900';

/** Primary CTA — slightly stronger scale + accent glow */
export const btnGesturePrimary =
  'transition-all duration-150 ease-out hover:scale-[1.03] active:scale-[0.96] hover:shadow-lg hover:shadow-emerald-500/20 focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-900';

/** Subtle — icon buttons, dismiss, small actions */
export const btnGestureSubtle =
  'transition-all duration-150 ease-out hover:scale-[1.01] active:scale-[0.98]';

/** Card gesture — gentle lift on hover */
export const cardGesture =
  'transition-all duration-200 ease-out hover:scale-[1.01] hover:shadow-xl';

/** Nav link — add active press feedback */
export const navGesture =
  'transition-all duration-150 ease-out active:scale-[0.97]';

/** Text link — color shift only */
export const linkGesture =
  'transition-colors duration-150 hover:text-emerald-400';
