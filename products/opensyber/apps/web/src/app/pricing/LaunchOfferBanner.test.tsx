/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LaunchOfferBanner } from './LaunchOfferBanner';

describe('LaunchOfferBanner', () => {
  const future = new Date('2030-01-15T00:00:00Z').toISOString();
  const past = new Date('2020-01-01T00:00:00Z').toISOString();
  const mockNow = new Date('2030-01-10T00:00:00Z');

  it('renders discount headline', () => {
    render(<LaunchOfferBanner expiresAt={future} now={mockNow} />);
    expect(screen.getByText(/40% off/)).toBeDefined();
  });

  it('renders custom discount percent', () => {
    render(
      <LaunchOfferBanner expiresAt={future} discountPercent={25} now={mockNow} />,
    );
    expect(screen.getByText(/25% off/)).toBeDefined();
  });

  it('renders default promo code LAUNCH40', () => {
    render(<LaunchOfferBanner expiresAt={future} now={mockNow} />);
    expect(screen.getByText('LAUNCH40')).toBeDefined();
  });

  it('renders custom promo code', () => {
    render(<LaunchOfferBanner expiresAt={future} code="EARLY50" now={mockNow} />);
    expect(screen.getByText('EARLY50')).toBeDefined();
  });

  it('renders countdown with days/hours/minutes', () => {
    render(<LaunchOfferBanner expiresAt={future} now={mockNow} />);
    const countdown = screen.getByTestId('countdown').textContent ?? '';
    expect(countdown).toMatch(/5d/);
    expect(countdown).toMatch(/0h/);
  });

  it('returns null when expired', () => {
    const { container } = render(
      <LaunchOfferBanner expiresAt={past} now={mockNow} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('exposes live region for screen readers', () => {
    render(<LaunchOfferBanner expiresAt={future} now={mockNow} />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });
});
