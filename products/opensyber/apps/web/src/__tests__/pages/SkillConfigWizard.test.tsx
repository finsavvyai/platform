import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SkillConfigWizard } from '@/app/dashboard/skills/[skillId]/configure/SkillConfigWizard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));
vi.mock('@/app/dashboard/skills/[skillId]/configure/ReviewStep', () => ({
  ReviewStep: ({ onContinue }: any) => (
    <div data-testid="review-step">
      <button onClick={onContinue}>Continue</button>
    </div>
  ),
}));
vi.mock('@/app/dashboard/skills/[skillId]/configure/ConfigureStep', () => ({
  ConfigureStep: () => <div data-testid="configure-step" />,
}));
vi.mock('@/app/dashboard/skills/[skillId]/configure/ConnectStep', () => ({
  ConnectStep: () => <div data-testid="connect-step" />,
}));
vi.mock('@/app/dashboard/skills/[skillId]/configure/ActivateStep', () => ({
  ActivateStep: () => <div data-testid="activate-step" />,
}));

const baseProps = {
  skill: {
    id: 'sk1',
    slug: 'test-skill',
    name: 'Test Skill',
    description: 'A skill',
    category: 'security',
    currentVersion: '1.0.0',
  },
  manifest: { permissions: { env: ['API_KEY'], network: ['*.api.com'], filesystem: ['/tmp'] } },
  installation: null,
  instanceId: 'inst-1',
};

describe('SkillConfigWizard', () => {
  it('renders skill name in heading', () => {
    render(<SkillConfigWizard {...baseProps} />);
    expect(screen.getByText('Configure Test Skill')).toBeInTheDocument();
  });

  it('renders step indicators', () => {
    render(<SkillConfigWizard {...baseProps} />);
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Configure')).toBeInTheDocument();
    expect(screen.getByText('Connect')).toBeInTheDocument();
    expect(screen.getByText('Activate')).toBeInTheDocument();
  });

  it('starts on Review step when no installation', () => {
    render(<SkillConfigWizard {...baseProps} />);
    expect(screen.getByTestId('review-step')).toBeInTheDocument();
  });

  it('starts on Configure step when installation exists', () => {
    const props = {
      ...baseProps,
      installation: { id: 'inst-1', isActive: false },
    };
    render(<SkillConfigWizard {...props} />);
    expect(screen.getByTestId('configure-step')).toBeInTheDocument();
  });

  it('renders back to skills link', () => {
    render(<SkillConfigWizard {...baseProps} />);
    expect(screen.getByText(/Back to Skills/)).toBeInTheDocument();
  });
});
