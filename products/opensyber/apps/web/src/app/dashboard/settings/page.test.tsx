/**
 * @vitest-environment jsdom
 *
 * SettingsPage is an async server component. We mock all external
 * dependencies and test the function can be called and returns JSX.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('../../packages/shared/src/index.ts', () => ({
  REGION_LABELS: { 'eu-central': 'EU Central' } as Record<string, string>,
  PLAN_CONFIGS: {
    free: {
      name: 'Free',
      price: 0,
      instanceLimit: 1,
      auditLogRetentionDays: 7,
      allowUnverifiedSkills: false,
      supportLevel: 'community',
    },
  } as Record<string, any>,
}));

vi.mock('@/lib/auth-token', () => ({
  getApiToken: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/api', () => ({
  apiClient: vi.fn().mockRejectedValue(new Error('no token')),
}));

vi.mock('@/components/dashboard/DeleteInstanceButton', () => ({
  DeleteInstanceButton: () => <button>Delete</button>,
}));
vi.mock('@/components/dashboard/ReferralSection', () => ({
  ReferralSection: () => <div>Referrals</div>,
}));
vi.mock('@/components/dashboard/BadgeEmbed', () => ({
  BadgeEmbed: () => <div>Badge</div>,
}));
vi.mock('@/components/dashboard/ScorecardShareCard', () => ({
  ScorecardShareCard: () => <div>Scorecard</div>,
}));
vi.mock('@/components/dashboard/security/SecretsList', () => ({
  SecretsList: () => <div>Secrets</div>,
}));
vi.mock('@/components/dashboard/security/AddSecretForm', () => ({
  AddSecretForm: () => <div>Add Secret</div>,
}));

describe('SettingsPage', () => {
  it('renders settings heading when no auth token', async () => {
    const { default: SettingsPage } = await import('./page');
    const result = await SettingsPage();
    render(result);
    expect(screen.getByText('Settings')).toBeDefined();
  });

  it('renders subscription card fallback', async () => {
    const { default: SettingsPage } = await import('./page');
    const result = await SettingsPage();
    render(result);
    expect(screen.getByText('Subscription')).toBeDefined();
    expect(screen.getByText('Free')).toBeDefined();
  });

  it('renders instance card with no instance message', async () => {
    const { default: SettingsPage } = await import('./page');
    const result = await SettingsPage();
    render(result);
    expect(screen.getByText('Instance')).toBeDefined();
    expect(screen.getByText(/No instance deployed/)).toBeDefined();
  });

  it('renders referral section', async () => {
    const { default: SettingsPage } = await import('./page');
    const result = await SettingsPage();
    render(result);
    expect(screen.getByText('Referrals')).toBeDefined();
  });
});
