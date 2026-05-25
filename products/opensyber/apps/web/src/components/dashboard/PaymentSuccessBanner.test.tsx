/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaymentSuccessBanner } from './PaymentSuccessBanner';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(),
}));

import { useSearchParams } from 'next/navigation';

describe('PaymentSuccessBanner', () => {
  it('renders nothing when payment param is not present', () => {
    const mockParams = new URLSearchParams('');
    vi.mocked(useSearchParams).mockReturnValue(mockParams as any);

    const { container } = render(<PaymentSuccessBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when payment param is not "success"', () => {
    const mockParams = new URLSearchParams('payment=failed');
    vi.mocked(useSearchParams).mockReturnValue(mockParams as any);

    const { container } = render(<PaymentSuccessBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('renders success banner when payment=success', () => {
    const mockParams = new URLSearchParams('payment=success');
    vi.mocked(useSearchParams).mockReturnValue(mockParams as any);

    render(<PaymentSuccessBanner />);

    expect(screen.getByText(/Payment successful/i)).toBeDefined();
    expect(screen.getByText(/plan has been activated/i)).toBeDefined();
  });

  it('has correct styling classes for green theme', () => {
    const mockParams = new URLSearchParams('payment=success');
    vi.mocked(useSearchParams).mockReturnValue(mockParams as any);

    const { container } = render(<PaymentSuccessBanner />);
    const banner = container.firstChild as HTMLElement;

    expect(banner).toBeTruthy();
    expect(banner.className).toContain('border-green-500');
    expect(banner.className).toContain('bg-green-500');
    expect(banner.className).toContain('text-green-400');
  });
});
