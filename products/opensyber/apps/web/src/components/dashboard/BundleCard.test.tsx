/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BundleCard } from './BundleCard';
import type { BundleData } from './BundleCard';

function makeBundle(overrides: Partial<BundleData> = {}): BundleData {
  return {
    id: 'bundle_1',
    slug: 'starter',
    name: 'Starter Pack',
    tagline: 'Essential tools',
    description: 'A starter bundle',
    tier: 'free',
    priceCents: 0,
    skillCount: 3,
    icon: null,
    skills: [
      { skillId: 's1', skillName: 'SAST', skillSlug: 'sast', skillCategory: 'security' },
      { skillId: 's2', skillName: 'SBOM', skillSlug: 'sbom', skillCategory: 'compliance' },
    ],
    isSubscribed: false,
    ...overrides,
  };
}

describe('BundleCard', () => {
  it('renders bundle name and tagline', () => {
    render(<BundleCard bundle={makeBundle()} onActivate={vi.fn()} />);
    expect(screen.getByText('Starter Pack')).toBeDefined();
    expect(screen.getByText('Essential tools')).toBeDefined();
  });

  it('shows Free label when priceCents is 0', () => {
    render(<BundleCard bundle={makeBundle()} onActivate={vi.fn()} />);
    const freeLabels = screen.getAllByText('Free');
    // One for tier badge, one for price
    expect(freeLabels.length).toBe(2);
  });

  it('shows price for paid bundles', () => {
    const bundle = makeBundle({ priceCents: 1499, tier: 'pro' });
    render(<BundleCard bundle={bundle} onActivate={vi.fn()} />);
    expect(screen.getByText('$15/mo')).toBeDefined();
  });

  it('shows Activate Bundle button when not subscribed', () => {
    render(<BundleCard bundle={makeBundle()} onActivate={vi.fn()} />);
    expect(screen.getByText('Activate Bundle')).toBeDefined();
  });

  it('shows Active badge when subscribed', () => {
    const bundle = makeBundle({ isSubscribed: true });
    render(<BundleCard bundle={bundle} onActivate={vi.fn()} />);
    expect(screen.getByText('Active')).toBeDefined();
    expect(screen.queryByText('Activate Bundle')).toBeNull();
  });

  it('calls onActivate with bundle id on click', () => {
    const onActivate = vi.fn();
    render(<BundleCard bundle={makeBundle()} onActivate={onActivate} />);
    fireEvent.click(screen.getByText('Activate Bundle'));
    expect(onActivate).toHaveBeenCalledWith('bundle_1');
  });

  it('shows +N more when skills exceed 5', () => {
    const skills = Array.from({ length: 7 }, (_, i) => ({
      skillId: `s${i}`,
      skillName: `Skill ${i}`,
      skillSlug: `skill-${i}`,
      skillCategory: 'sec',
    }));
    const bundle = makeBundle({ skills });
    render(<BundleCard bundle={bundle} onActivate={vi.fn()} />);
    expect(screen.getByText('+2 more')).toBeDefined();
  });
});
