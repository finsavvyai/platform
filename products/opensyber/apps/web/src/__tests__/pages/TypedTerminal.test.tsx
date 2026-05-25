import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TypedTerminal } from '@/app/TypedTerminal';

vi.mock('framer-motion', () => ({
  motion: {
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
}));

describe('TypedTerminal', () => {
  it('renders terminal chrome', () => {
    render(<TypedTerminal />);
    expect(
      screen.getByText('tokenforge — session audit'),
    ).toBeInTheDocument();
  });

  it('renders ECDSA comment', () => {
    render(<TypedTerminal />);
    expect(
      screen.getByText('// Device bound via ECDSA P-256'),
    ).toBeInTheDocument();
  });

  it('renders trust score line', () => {
    render(<TypedTerminal />);
    expect(screen.getByText('trust_score')).toBeInTheDocument();
    expect(screen.getByText('94/100')).toBeInTheDocument();
  });

  it('renders action line', () => {
    render(<TypedTerminal />);
    expect(screen.getByText('action: allow')).toBeInTheDocument();
  });
});
