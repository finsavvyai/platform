/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OnboardingChecklist } from './OnboardingChecklist';

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

describe('OnboardingChecklist', () => {
  it('shows loading state initially', () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));
    render(<OnboardingChecklist plan="free" />);
    expect(screen.getByText('Loading onboarding progress...')).toBeDefined();
  });

  it('renders steps after loading', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ progress: {}, completedAt: null }),
    } as unknown as Response);

    render(<OnboardingChecklist plan="free" />);

    await waitFor(() => {
      expect(screen.getByText('Getting Started')).toBeDefined();
      expect(screen.getByText('Deploy your first agent')).toBeDefined();
      expect(screen.getByText('Install a skill')).toBeDefined();
    });
  });

  it('shows progress count', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          progress: { deployAgent: true, installSkill: true },
          completedAt: null,
        }),
    } as unknown as Response);

    render(<OnboardingChecklist plan="free" />);

    await waitFor(() => {
      expect(screen.getByText('2/5 steps complete')).toBeDefined();
    });
  });

  it('hides team-only steps for free plan', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ progress: {}, completedAt: null }),
    } as unknown as Response);

    render(<OnboardingChecklist plan="free" />);

    await waitFor(() => {
      expect(screen.getByText('Getting Started')).toBeDefined();
    });

    expect(screen.queryByText('Invite a team member')).toBeNull();
  });

  it('shows team-only steps for team plan', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ progress: {}, completedAt: null }),
    } as unknown as Response);

    render(<OnboardingChecklist plan="team" />);

    await waitFor(() => {
      expect(screen.getByText('Invite a team member')).toBeDefined();
    });
  });

  it('returns null when completed', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          progress: {},
          completedAt: '2026-01-01T00:00:00Z',
        }),
    } as unknown as Response);

    const { container } = render(<OnboardingChecklist plan="free" />);

    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });
  });

  it('dismisses checklist on X button click', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ progress: {}, completedAt: null }),
    } as unknown as Response);

    const { container } = render(<OnboardingChecklist plan="free" />);

    await waitFor(() => {
      expect(screen.getByText('Getting Started')).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText('Dismiss onboarding checklist'));

    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });
  });
});
