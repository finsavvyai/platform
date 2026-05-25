'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Thin progress bar at the top of the page during route transitions.
 * Uses Next.js pathname changes to detect navigation start/end.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [, _startTransition] = useTransition();

  useEffect(() => {
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect -- triggers progress on route change
    const timeout = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timeout);
  }, [pathname]);

  if (!loading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5">
      <div
        className="h-full bg-info animate-pulse"
        style={{ width: '80%', transition: 'width 200ms ease-out' }}
      />
    </div>
  );
}
