/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GettingStartedPage from './page';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('./OnboardingChecklist', () => ({
  default: () => <div data-testid="onboarding-checklist">Checklist</div>,
}));

vi.mock('./PrereqStatus', () => ({
  default: () => <div data-testid="prereq-status">Prerequisites</div>,
}));

vi.mock('./IntegrationGuides', () => ({
  default: () => <div data-testid="integration-guides">Guides</div>,
}));

describe('GettingStartedPage (dashboard)', () => {
  it('renders the page heading', () => {
    render(<GettingStartedPage />);
    expect(screen.getByText('Getting Started')).toBeDefined();
  });

  it('renders onboarding checklist', () => {
    render(<GettingStartedPage />);
    expect(screen.getByTestId('onboarding-checklist')).toBeDefined();
  });

  it('renders prerequisite status', () => {
    render(<GettingStartedPage />);
    expect(screen.getByTestId('prereq-status')).toBeDefined();
  });

  it('renders integration guides', () => {
    render(<GettingStartedPage />);
    expect(screen.getByTestId('integration-guides')).toBeDefined();
  });

  it('renders bottom CTA links', () => {
    render(<GettingStartedPage />);
    const browseLink = screen.getByText('Browse All Integrations').closest('a');
    expect(browseLink?.getAttribute('href')).toBe('/dashboard/integrations');
    const buildLink = screen.getByText('Build Your Own').closest('a');
    expect(buildLink?.getAttribute('href')).toBe('/docs/skills');
  });
});
