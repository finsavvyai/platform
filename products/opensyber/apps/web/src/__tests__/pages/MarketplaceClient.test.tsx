import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarketplaceClient } from '@/app/dashboard/marketplace/MarketplaceClient';

vi.mock('@/app/dashboard/marketplace/InstallModal', () => ({
  InstallModal: () => <div data-testid="install-modal" />,
}));
vi.mock('@/app/dashboard/marketplace/MarketplaceEmpty', () => ({
  MarketplaceEmpty: () => <p>No skills found</p>,
}));
vi.mock('@/app/dashboard/marketplace/SkillSuggestions', () => ({
  SkillSuggestions: () => <div data-testid="suggestions" />,
}));
vi.mock('@/app/dashboard/marketplace/SkillCard', () => ({
  SkillCard: ({ skill }: any) => <div data-testid={`skill-${skill.id}`}>{skill.name}</div>,
}));

const mockSkill = {
  id: 's1',
  name: 'Test Skill',
  slug: 'test-skill',
  description: 'A test skill',
  category: 'security',
  tier: 'free',
  installCount: 10,
  ratingAvg: 4.5,
  ratingCount: 3,
  isFeatured: false,
  isCertified: false,
};

const featured = { ...mockSkill, id: 'f1', name: 'Top Skill', isFeatured: true };

describe('MarketplaceClient', () => {
  it('renders heading and description', () => {
    render(
      <MarketplaceClient skills={[]} featured={[]} agents={[]} />,
    );
    expect(screen.getByText(/Skills for AI agent security/)).toBeInTheDocument();
    expect(screen.getByText(/attack patterns observed in recent AI agent incidents/)).toBeInTheDocument();
  });

  it('renders category tabs', () => {
    render(
      <MarketplaceClient skills={[]} featured={[]} agents={[]} />,
    );
    expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Security' })).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(
      <MarketplaceClient skills={[]} featured={[]} agents={[]} />,
    );
    expect(screen.getByPlaceholderText('Search skills...')).toBeInTheDocument();
  });

  it('renders skills list', () => {
    render(
      <MarketplaceClient skills={[mockSkill]} featured={[]} agents={[]} />,
    );
    expect(screen.getByTestId('skill-s1')).toBeInTheDocument();
  });

  it('renders featured section when featured skills exist', () => {
    render(
      <MarketplaceClient skills={[mockSkill]} featured={[featured]} agents={[]} />,
    );
    expect(screen.getByText('Top Skill')).toBeInTheDocument();
  });

  it('filters by search', () => {
    render(
      <MarketplaceClient skills={[mockSkill]} featured={[]} agents={[]} />,
    );
    fireEvent.change(screen.getByPlaceholderText('Search skills...'), {
      target: { value: 'nonexistent' },
    });
    expect(screen.getByText('No skills found')).toBeInTheDocument();
  });

  it('shows empty state when no skills match', () => {
    render(
      <MarketplaceClient skills={[]} featured={[]} agents={[]} />,
    );
    expect(screen.getByText('No skills found')).toBeInTheDocument();
  });
});
