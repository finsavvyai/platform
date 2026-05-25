import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WelcomeModal } from './WelcomeModal';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Test' } }, status: 'authenticated' }),
}));

vi.mock('framer-motion', () => ({
  motion: { div: 'div' },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/ui/Portal', () => ({
  Portal: ({ children }: { children: React.ReactNode }) => children,
}));

const store: Record<string, string> = {};

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((k) => store[k] ?? null);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k, v) => { store[k] = v; });
});

describe('WelcomeModal', () => {
  it('renders greeting with user name', () => {
    render(<WelcomeModal />);
    expect(screen.getByText(/Welcome to OpenSyber, Test!/)).toBeTruthy();
  });

  it('shows benefit cards', () => {
    render(<WelcomeModal />);
    expect(screen.getByText('Deploy in 60s')).toBeTruthy();
    expect(screen.getByText('Real-time Security')).toBeTruthy();
    expect(screen.getByText('AI-Powered Insights')).toBeTruthy();
  });

  it('stores dismissal in localStorage', () => {
    render(<WelcomeModal />);
    fireEvent.click(screen.getByText("Let's Get Started"));
    expect(store['opensyber_welcome_seen']).toBe('1');
  });
});
