import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import BusFactorBadge from './BusFactorBadge';

describe('BusFactorBadge', () => {
  it('renders BF:1 with single-owner label for risky files', () => {
    render(<BusFactorBadge busFactor={1} />);
    const badge = screen.getByLabelText(/bus factor 1/i);
    expect(badge).toHaveTextContent('BF:1');
    expect(badge).toHaveAttribute('aria-label', expect.stringMatching(/single owner/i));
  });

  it('renders BF:3+ for any BF >= 3', () => {
    render(<BusFactorBadge busFactor={7} />);
    expect(screen.getByText('BF:3+')).toBeInTheDocument();
  });

  it('renders BF:0 for abandoned files', () => {
    render(<BusFactorBadge busFactor={0} />);
    expect(screen.getByText('BF:0')).toBeInTheDocument();
  });
});
