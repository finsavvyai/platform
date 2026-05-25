import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlan } from '../hooks/usePlan';
import { linkGesture, btnGestureSubtle } from '../styles/gestures';

const DISMISS_KEY = 'pushci_free_banner_dismissed';

export default function FreeUserWelcome() {
  const { isFree, loading } = usePlan();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === '1',
  );

  if (loading || !isFree || dismissed) return null;

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3 mb-5">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-200 font-medium">
          You are on the Free plan
        </p>
        <p className="text-xs text-zinc-400 mt-0.5">
          Upgrade to Pro for AI diagnosis, cloud runners, and priority support.
        </p>
        <Link
          to="/billing?upgrade=pro"
          className={`inline-block mt-2 text-xs font-medium text-emerald-400 hover:text-emerald-300 ${linkGesture}`}
        >
          View plans &rarr;
        </Link>
      </div>
      <button
        onClick={handleDismiss}
        className={`text-zinc-500 hover:text-zinc-300 p-1 ${btnGestureSubtle}`}
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
