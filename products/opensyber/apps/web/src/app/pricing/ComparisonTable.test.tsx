/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComparisonTable } from './ComparisonTable';

describe('ComparisonTable', () => {
  it('renders section heading', () => {
    render(<ComparisonTable />);
    expect(screen.getByText(/WHY NOT JUST USE WIZ/)).toBeDefined();
  });

  it('renders all competitor columns', () => {
    render(<ComparisonTable />);
    expect(screen.getByText('OpenSyber')).toBeDefined();
    expect(screen.getByText('Wiz')).toBeDefined();
    expect(screen.getByText('Snyk')).toBeDefined();
    expect(screen.getByText('GitHub Advanced Security')).toBeDefined();
  });

  it('renders capability rows', () => {
    render(<ComparisonTable />);
    expect(screen.getByText(/AI agent security runtime/)).toBeDefined();
    expect(screen.getByText(/TokenForge/)).toBeDefined();
    expect(screen.getByText(/Skill marketplace/)).toBeDefined();
  });

  it('renders OpenSyber entry price', () => {
    render(<ComparisonTable />);
    expect(screen.getByText('$299/mo')).toBeDefined();
  });

  it('renders competitor price points', () => {
    render(<ComparisonTable />);
    expect(screen.getByText(/\$3,000\+/)).toBeDefined();
  });

  it('renders check marks for yes capabilities', () => {
    const { container } = render(<ComparisonTable />);
    const checks = container.querySelectorAll('[aria-label="yes"]');
    expect(checks.length).toBeGreaterThan(5);
  });

  it('renders X marks for missing capabilities', () => {
    const { container } = render(<ComparisonTable />);
    const missing = container.querySelectorAll('[aria-label="no"]');
    expect(missing.length).toBeGreaterThan(0);
  });

  it('has accessible heading for the section', () => {
    render(<ComparisonTable />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toMatch(/WIZ/);
  });
});
