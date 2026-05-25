/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Breadcrumbs } from './Breadcrumbs';

let mockPathname = '/dashboard';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

describe('Breadcrumbs', () => {
  it('returns null when on a single-segment path', () => {
    mockPathname = '/dashboard';
    const { container } = render(<Breadcrumbs />);
    expect(container.firstChild).toBeNull();
  });

  it('renders breadcrumb nav for multi-segment paths', () => {
    mockPathname = '/dashboard/settings';
    render(<Breadcrumbs />);
    expect(screen.getByLabelText('Breadcrumb')).toBeDefined();
  });

  it('renders known label from LABEL_MAP', () => {
    mockPathname = '/dashboard/skills';
    render(<Breadcrumbs />);
    expect(screen.getByText('Skills')).toBeDefined();
  });

  it('renders Dashboard as link and last segment as span', () => {
    mockPathname = '/dashboard/settings';
    render(<Breadcrumbs />);
    const dashLink = screen.getByText('Dashboard');
    expect(dashLink.tagName).toBe('A');
    const settings = screen.getByText('Settings');
    expect(settings.tagName).toBe('SPAN');
  });

  it('formats unknown segments with title case', () => {
    mockPathname = '/dashboard/some-custom-page';
    render(<Breadcrumbs />);
    expect(screen.getByText('Some Custom Page')).toBeDefined();
  });

  it('renders three-level breadcrumbs', () => {
    mockPathname = '/dashboard/security/alerts';
    render(<Breadcrumbs />);
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Agent Activity')).toBeDefined();
  });
});
