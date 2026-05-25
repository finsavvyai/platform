'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import type { ComponentProps, PropsWithChildren } from 'react';
import { trackCompareEvent } from '@/lib/analytics/compare';

type CompareTrackingProps = {
  comparePage: string;
};

type TrackedCompareLinkProps = PropsWithChildren<
  Omit<ComponentProps<typeof Link>, 'onClick'> &
  CompareTrackingProps & {
    ctaLabel: string;
  }
>;

export function ComparePageViewTracker({ comparePage }: CompareTrackingProps) {
  useEffect(() => {
    trackCompareEvent('compare_page_view', { compare_page: comparePage });
  }, [comparePage]);

  return null;
}

export function TrackedCompareLink({
  comparePage,
  ctaLabel,
  href,
  children,
  ...props
}: TrackedCompareLinkProps) {
  const destination = typeof href === 'string' ? href : href.toString();

  return (
    <Link
      href={href}
      onClick={() =>
        trackCompareEvent('compare_cta_click', {
          compare_page: comparePage,
          cta_label: ctaLabel,
          destination,
        })}
      {...props}
    >
      {children}
    </Link>
  );
}
