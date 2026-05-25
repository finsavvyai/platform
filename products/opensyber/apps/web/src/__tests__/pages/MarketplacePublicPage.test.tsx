import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MarketplacePage from '@/app/marketplace/page';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));
vi.mock('@/lib/auth-token', () => ({
  getApiToken: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/api', () => ({
  apiClient: vi.fn().mockResolvedValue({ skills: [] }),
}));
vi.mock('@opensyber/shared', () => ({
  SKILL_CATEGORY_LABELS: {
    productivity: 'Productivity',
    developer: 'Developer',
    finance: 'Finance',
    communication: 'Communication',
    home: 'Home',
    security: 'Security',
    utilities: 'Utilities',
  },
}));
vi.mock('@/components/marketplace/InstallSkillButton', () => ({
  InstallSkillButton: () => <button>Install</button>,
}));
vi.mock('@/components/marketplace/SkillGrid', () => ({
  SkillGrid: ({ children }: any) => <div>{children}</div>,
  SkillCard: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/components/SiteHeader', () => ({
  SiteHeader: () => <header data-testid="header" />,
}));
vi.mock('@/app/marketplace/marketplace-utils', () => ({
  CATEGORY_STYLES: {},
  getSkillIcon: () => () => <span data-testid="skill-icon" />,
}));

describe('MarketplacePage (public)', () => {
  it('renders heading', async () => {
    const result = await MarketplacePage({
      searchParams: Promise.resolve({}),
    });
    render(result);
    expect(screen.getByText(/Skills for AI agent security/)).toBeInTheDocument();
  });

  it('renders empty state when no skills', async () => {
    const result = await MarketplacePage({
      searchParams: Promise.resolve({}),
    });
    render(result);
    expect(screen.getByText('No skills found')).toBeInTheDocument();
  });

  it('renders category filter links', async () => {
    const result = await MarketplacePage({
      searchParams: Promise.resolve({}),
    });
    render(result);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
  });

  it('renders footer', async () => {
    const result = await MarketplacePage({
      searchParams: Promise.resolve({}),
    });
    render(result);
    expect(screen.getByText(/2026 OpenSyber/)).toBeInTheDocument();
  });
});
