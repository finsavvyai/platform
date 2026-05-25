import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SkillCard } from '@/app/dashboard/marketplace/SkillCard';

const baseSkill = {
  id: 'sk1',
  name: 'Network Scanner',
  slug: 'network-scanner',
  description: 'Scans network for vulnerabilities',
  category: 'security',
  tier: 'free',
  installCount: 42,
  ratingAvg: 4.0,
  ratingCount: 5,
  isFeatured: false,
  isCertified: false,
  isSigned: false,
  hasSbom: false,
};

describe('SkillCard', () => {
  it('renders skill name and category', () => {
    render(<SkillCard skill={baseSkill} onInstall={vi.fn()} />);
    expect(screen.getByText('Network Scanner')).toBeInTheDocument();
    expect(screen.getByText('security')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<SkillCard skill={baseSkill} onInstall={vi.fn()} />);
    expect(
      screen.getByText('Scans network for vulnerabilities'),
    ).toBeInTheDocument();
  });

  it('renders tier badge', () => {
    render(<SkillCard skill={baseSkill} onInstall={vi.fn()} />);
    expect(screen.getByText('free')).toBeInTheDocument();
  });

  it('renders install button when not installed', () => {
    render(<SkillCard skill={baseSkill} onInstall={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /Install Network Scanner/ }),
    ).toBeInTheDocument();
  });

  it('shows Installed badge when installed', () => {
    render(
      <SkillCard skill={baseSkill} onInstall={vi.fn()} isInstalled />,
    );
    expect(screen.getByText('Installed')).toBeInTheDocument();
  });

  it('calls onInstall when install button clicked', () => {
    const onInstall = vi.fn();
    render(<SkillCard skill={baseSkill} onInstall={onInstall} />);
    fireEvent.click(
      screen.getByRole('button', { name: /Install Network Scanner/ }),
    );
    expect(onInstall).toHaveBeenCalledWith(baseSkill);
  });

  it('shows verified badge for certified skills', () => {
    const certifiedSkill = { ...baseSkill, isCertified: true };
    render(<SkillCard skill={certifiedSkill} onInstall={vi.fn()} />);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('shows signed and sbom trust badges when present', () => {
    const trustedSkill = { ...baseSkill, isSigned: true, hasSbom: true };
    render(<SkillCard skill={trustedSkill} onInstall={vi.fn()} />);
    expect(screen.getByText('Signed')).toBeInTheDocument();
    expect(screen.getByText('SBOM')).toBeInTheDocument();
  });

  it('shows No description when description is null', () => {
    const noDesc = { ...baseSkill, description: null };
    render(<SkillCard skill={noDesc} onInstall={vi.fn()} />);
    expect(screen.getByText('No description')).toBeInTheDocument();
  });
});
