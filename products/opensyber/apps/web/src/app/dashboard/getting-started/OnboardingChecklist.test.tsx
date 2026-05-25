/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import OnboardingChecklist from './OnboardingChecklist';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('OnboardingChecklist', () => {
  it('shows loading state initially', () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as any;
    render(<OnboardingChecklist />);
    expect(screen.getByText('Loading your progress...')).toBeDefined();
  });

  it('renders progress bar and steps after loading', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          progress: {
            deployAgent: true,
            installSkill: false,
            setupAlertRule: false,
            storeSecret: false,
            reviewSecurity: false,
          },
        }),
      }),
    ) as any;

    render(<OnboardingChecklist />);
    await waitFor(() => {
      expect(screen.getByText('Onboarding Progress')).toBeDefined();
    });
    expect(screen.getByText('1/5 completed')).toBeDefined();
    expect(screen.getByText('Deploy an agent instance')).toBeDefined();
    expect(screen.getByText('Install a security skill')).toBeDefined();
  });

  it('shows completion message when all steps done', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          progress: {
            deployAgent: true,
            installSkill: true,
            setupAlertRule: true,
            storeSecret: true,
            reviewSecurity: true,
          },
        }),
      }),
    ) as any;

    render(<OnboardingChecklist />);
    await waitFor(() => {
      expect(screen.getByText(/All steps complete/)).toBeDefined();
    });
  });

  it('handles fetch error gracefully', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error'))) as any;
    render(<OnboardingChecklist />);
    await waitFor(() => {
      expect(screen.getByText('Onboarding Progress')).toBeDefined();
    });
    expect(screen.getByText('0/5 completed')).toBeDefined();
  });
});
