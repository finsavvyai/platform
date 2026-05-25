/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ComparePageViewTracker, TrackedCompareLink } from './CompareAnalytics';

const trackCompareEvent = vi.fn();

vi.mock('@/lib/analytics/compare', () => ({
  trackCompareEvent: (...args: unknown[]) => trackCompareEvent(...args),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

describe('Compare analytics components', () => {
  it('tracks compare page views on mount', () => {
    render(<ComparePageViewTracker comparePage="/compare/opensyber-vs-modal" />);

    expect(trackCompareEvent).toHaveBeenCalledWith('compare_page_view', {
      compare_page: '/compare/opensyber-vs-modal',
    });
  });

  it('tracks CTA clicks with page context', () => {
    render(
      <TrackedCompareLink
        href="/sign-up"
        comparePage="/compare/opensyber-vs-modal"
        ctaLabel="start-free"
      >
        Start free
      </TrackedCompareLink>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Start free' }));

    expect(trackCompareEvent).toHaveBeenCalledWith('compare_cta_click', {
      compare_page: '/compare/opensyber-vs-modal',
      cta_label: 'start-free',
      destination: '/sign-up',
    });
  });
});
