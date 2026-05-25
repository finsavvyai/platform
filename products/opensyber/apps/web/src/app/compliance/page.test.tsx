/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompliancePage from './page';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('@/components/SiteHeader', () => ({
  SiteHeader: () => <nav data-testid="site-header">Header</nav>,
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

describe('CompliancePage', () => {
  it('renders the page heading', () => {
    render(<CompliancePage />);
    expect(screen.getByText('AI Agent Compliance')).toBeDefined();
  });

  it('renders framework names with statuses', () => {
    render(<CompliancePage />);
    expect(screen.getByText('SOC 2 Type I')).toBeDefined();
    expect(screen.getByText('ISO 27001')).toBeDefined();
    expect(screen.getByText('NIST AI RMF')).toBeDefined();
    expect(screen.getByText('GDPR')).toBeDefined();
    expect(screen.getByText('EU AI Act')).toBeDefined();
  });

  it('renders framework statuses', () => {
    render(<CompliancePage />);
    expect(screen.getAllByText('In Progress').length).toBe(2);
    expect(screen.getAllByText('Supported').length).toBe(2);
    expect(screen.getByText('Roadmap')).toBeDefined();
  });

  it('renders capability cards', () => {
    render(<CompliancePage />);
    expect(screen.getByText('Agent Inventory & Registry')).toBeDefined();
    expect(screen.getByText('Policy Enforcement Engine')).toBeDefined();
    expect(screen.getByText('Audit-Ready Reports')).toBeDefined();
    expect(screen.getByText('Data Residency Controls')).toBeDefined();
  });

  it('renders CTA links', () => {
    render(<CompliancePage />);
    const assessmentLink = screen.getByText('Start Your Assessment').closest('a');
    expect(assessmentLink?.getAttribute('href')).toBe('/sign-up');
    const salesLink = screen.getByText('Contact Sales').closest('a');
    expect(salesLink?.getAttribute('href')).toBe('/enterprise');
  });
});
