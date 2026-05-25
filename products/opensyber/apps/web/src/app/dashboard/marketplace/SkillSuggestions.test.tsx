/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SkillSuggestions } from './SkillSuggestions';

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

const recommendations = [
  {
    skillSlug: 'sast-scanner',
    reason: 'No static analysis detected',
    priority: 'high' as const,
    signal: 'missing_sast',
    skill: {
      id: 'skill_1',
      name: 'SAST Scanner',
      slug: 'sast-scanner',
      description: 'Static analysis',
      tier: 'free',
      category: 'security',
    },
  },
  {
    skillSlug: 'sbom-gen',
    reason: 'SBOM not configured',
    priority: 'medium' as const,
    signal: 'missing_sbom',
    skill: {
      id: 'skill_2',
      name: 'SBOM Generator',
      slug: 'sbom-gen',
      description: 'Generate SBOMs',
      tier: 'pro',
      category: 'compliance',
    },
  },
];

const agents = [{ id: 'a1', name: 'Agent 1' }];

describe('SkillSuggestions', () => {
  it('renders recommendation list', () => {
    render(
      <SkillSuggestions
        recommendations={recommendations}
        agents={agents}
        onInstall={vi.fn()}
      />,
    );
    expect(screen.getByText('Recommended for you')).toBeDefined();
    expect(screen.getByText('SAST Scanner')).toBeDefined();
    expect(screen.getByText('SBOM Generator')).toBeDefined();
  });

  it('returns null when no visible recommendations', () => {
    const { container } = render(
      <SkillSuggestions
        recommendations={[]}
        agents={agents}
        onInstall={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('hides already-installed skills', () => {
    const { container } = render(
      <SkillSuggestions
        recommendations={recommendations}
        agents={agents}
        onInstall={vi.fn()}
        installedSkillIds={['skill_1', 'skill_2']}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('dismisses recommendation on X click', () => {
    render(
      <SkillSuggestions
        recommendations={recommendations}
        agents={agents}
        onInstall={vi.fn()}
      />,
    );
    const dismissBtns = screen.getAllByTitle('Dismiss');
    fireEvent.click(dismissBtns[0]);
    expect(screen.queryByText('SAST Scanner')).toBeNull();
    expect(screen.getByText('SBOM Generator')).toBeDefined();
  });

  it('calls onInstall when chevron is clicked', () => {
    const onInstall = vi.fn();
    render(
      <SkillSuggestions
        recommendations={recommendations}
        agents={agents}
        onInstall={onInstall}
      />,
    );
    const chooseBtns = screen.getAllByTitle('Choose agents');
    fireEvent.click(chooseBtns[0]);
    expect(onInstall).toHaveBeenCalledWith('skill_1');
  });

  it('shows Install button when agent exists', () => {
    render(
      <SkillSuggestions
        recommendations={recommendations}
        agents={agents}
        onInstall={vi.fn()}
      />,
    );
    // Single agent: shows "Install" not "Install All"
    const installBtns = screen.getAllByText('Install');
    expect(installBtns.length).toBeGreaterThan(0);
  });

  it('shows Install All when multiple agents', () => {
    render(
      <SkillSuggestions
        recommendations={recommendations}
        agents={[...agents, { id: 'a2', name: 'Agent 2' }]}
        onInstall={vi.fn()}
      />,
    );
    const installBtns = screen.getAllByText('Install All');
    expect(installBtns.length).toBe(2);
  });
});
