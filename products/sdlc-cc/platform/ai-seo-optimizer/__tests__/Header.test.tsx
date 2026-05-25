import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  signOut: vi.fn(),
}));

import Header from '../components/Header';

describe('Header', () => {
  it('renders the brand name', () => {
    render(<Header />);
    expect(screen.getByText('RankAI')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(<Header />);
    expect(screen.getByText('Analyzer')).toBeInTheDocument();
    expect(screen.getByText('llms.txt')).toBeInTheDocument();
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('Pricing')).toBeInTheDocument();
  });

  it('renders sign in and get started when logged out', () => {
    render(<Header />);
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(screen.getByText('Get Started')).toBeInTheDocument();
  });

  it('toggles mobile menu', () => {
    render(<Header />);
    const menuButton = screen.getByLabelText('Open menu');
    fireEvent.click(menuButton);
    expect(screen.getByLabelText('Close menu')).toBeInTheDocument();
  });
});
