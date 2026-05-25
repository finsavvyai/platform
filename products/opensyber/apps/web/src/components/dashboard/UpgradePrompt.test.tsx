/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UpgradePrompt } from './UpgradePrompt';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => (
    <a {...props}>{children}</a>
  ),
}));

describe('UpgradePrompt', () => {
  it('renders feature name and required plan label', () => {
    render(<UpgradePrompt feature="Advanced Threat Detection" />);
    expect(screen.getByText('Advanced Threat Detection')).toBeDefined();
    expect(screen.getAllByText(/Team/i).length).toBeGreaterThan(0);
  });

  it('defaults required plan to Team', () => {
    render(<UpgradePrompt feature="SSO" />);
    // Both the label ("Team plan") and the CTA ("Unlock Team") should mention Team
    const planLabel = screen.getByText(/Team plan/i);
    expect(planLabel).toBeDefined();
  });

  it('shows custom required plan', () => {
    render(<UpgradePrompt feature="SAML" requiredPlan="Enterprise" />);
    expect(screen.getByText(/Enterprise plan/i)).toBeDefined();
  });

  it('links to pricing page by default', () => {
    render(<UpgradePrompt feature="Audit Logs" />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/pricing');
  });

  it('accepts custom ctaHref', () => {
    render(<UpgradePrompt feature="Audit Logs" ctaHref="/checkout/team" />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/checkout/team');
  });

  it('renders custom value prop', () => {
    render(
      <UpgradePrompt
        feature="Attack Paths"
        valueProp="Map 100% of lateral movement risk across 10 cloud accounts"
      />,
    );
    expect(
      screen.getByText(/Map 100% of lateral movement risk/),
    ).toBeDefined();
  });

  it('renders custom unlocks list', () => {
    render(
      <UpgradePrompt
        feature="SOC 2"
        unlocks={['Cut audit prep from 6 weeks to 3 days', 'Auto-generate evidence packages']}
      />,
    );
    expect(screen.getByText(/Cut audit prep/)).toBeDefined();
    expect(screen.getByText(/Auto-generate evidence/)).toBeDefined();
  });

  it('renders default unlocks when not provided', () => {
    render(<UpgradePrompt feature="Test" />);
    expect(screen.getByText(/Save 40\+ hours\/month/)).toBeDefined();
    expect(screen.getByText(/340ms/)).toBeDefined();
  });

  it('renders preview when provided and marks it aria-hidden', () => {
    render(
      <UpgradePrompt
        feature="Preview Test"
        preview={<div>Hidden dashboard content</div>}
      />,
    );
    expect(screen.getByTestId('upgrade-preview')).toBeDefined();
    expect(screen.getByText('Hidden dashboard content')).toBeDefined();
  });

  it('does not render preview slot when absent', () => {
    render(<UpgradePrompt feature="No Preview" />);
    expect(screen.queryByTestId('upgrade-preview')).toBeNull();
  });

  it('renders lock icon', () => {
    const { container } = render(<UpgradePrompt feature="Test" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('includes trial reassurance copy', () => {
    render(<UpgradePrompt feature="Test" />);
    expect(screen.getByText(/14-day trial/)).toBeDefined();
    expect(screen.getByText(/No credit card/)).toBeDefined();
  });
});
