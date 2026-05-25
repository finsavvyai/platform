import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SkillDetailPage from '@/app/marketplace/[slug]/page';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));
vi.mock('@/lib/auth-token', () => ({
  getApiToken: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/api', () => ({
  apiClient: vi.fn().mockRejectedValue(new Error('not found')),
}));
vi.mock('@opensyber/shared', () => ({
  SKILL_CATEGORY_LABELS: {
    security: 'Security',
    developer: 'Developer',
  },
}));
vi.mock('@/components/marketplace/InstallSkillButton', () => ({
  InstallSkillButton: () => <button>Install</button>,
}));
vi.mock('@/components/SiteHeader', () => ({
  SiteHeader: () => <header data-testid="header" />,
}));
vi.mock('@/app/marketplace/marketplace-utils', () => ({
  CATEGORY_STYLES: {},
  getSkillIcon: () => () => <span data-testid="skill-icon" />,
}));

describe('SkillDetailPage', () => {
  it('renders not-found state when skill missing', async () => {
    const result = await SkillDetailPage({
      params: Promise.resolve({ slug: 'nonexistent' }),
    });
    render(result);
    expect(screen.getByText('Skill not found')).toBeInTheDocument();
  });

  it('renders back to marketplace link', async () => {
    const result = await SkillDetailPage({
      params: Promise.resolve({ slug: 'nonexistent' }),
    });
    render(result);
    expect(
      screen.getByText('Back to Marketplace'),
    ).toBeInTheDocument();
  });
});
