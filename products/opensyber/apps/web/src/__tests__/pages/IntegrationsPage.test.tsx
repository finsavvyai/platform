import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import IntegrationsPage from '@/app/dashboard/integrations/page';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('@/app/dashboard/integrations/integrations-data', () => {
  const DummyIcon = () => <span data-testid="icon" />;
  return {
    INTEGRATIONS: [
      {
        slug: 'slack',
        name: 'Slack',
        description: 'Send alerts to Slack',
        category: 'communication',
        tier: 'free',
        color: '#4A154B',
        features: ['Alerts', 'Events', 'Summaries'],
      },
      {
        slug: 'aws',
        name: 'AWS',
        description: 'Connect AWS accounts',
        category: 'cloud',
        tier: 'pro',
        color: '#FF9900',
        features: ['CSPM', 'IAM Audit'],
      },
    ],
    CATEGORY_META: {
      communication: { label: 'Communication', icon: DummyIcon, color: 'text-green-400' },
      cloud: { label: 'Cloud Providers', icon: DummyIcon, color: 'text-blue-400' },
    },
  };
});

describe('IntegrationsPage', () => {
  it('renders heading', () => {
    render(<IntegrationsPage />);
    expect(screen.getByText('Integrations')).toBeInTheDocument();
  });

  it('renders integration count in description', () => {
    render(<IntegrationsPage />);
    expect(
      screen.getByText(/2 integrations available/),
    ).toBeInTheDocument();
  });

  it('renders stats bar', () => {
    render(<IntegrationsPage />);
    expect(screen.getByText('Total Integrations')).toBeInTheDocument();
    expect(screen.getByText('Categories')).toBeInTheDocument();
  });

  it('renders category sections', () => {
    render(<IntegrationsPage />);
    expect(screen.getByText('Communication')).toBeInTheDocument();
    expect(screen.getByText('Cloud Providers')).toBeInTheDocument();
  });

  it('renders integration cards', () => {
    render(<IntegrationsPage />);
    expect(screen.getByText('Slack')).toBeInTheDocument();
    expect(screen.getByText('AWS')).toBeInTheDocument();
    expect(screen.getByText('Send alerts to Slack')).toBeInTheDocument();
  });

  it('renders tier badges', () => {
    render(<IntegrationsPage />);
    expect(screen.getByText('free')).toBeInTheDocument();
    expect(screen.getByText('pro')).toBeInTheDocument();
  });
});
