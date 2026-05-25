/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleBadge } from './RoleBadge';

describe('RoleBadge', () => {
  it('renders owner label', () => {
    render(<RoleBadge role="owner" />);
    expect(screen.getByText('Owner')).toBeDefined();
  });

  it('renders admin label', () => {
    render(<RoleBadge role="admin" />);
    expect(screen.getByText('Admin')).toBeDefined();
  });

  it('renders developer label', () => {
    render(<RoleBadge role="developer" />);
    expect(screen.getByText('Developer')).toBeDefined();
  });

  it('renders viewer label', () => {
    render(<RoleBadge role="viewer" />);
    expect(screen.getByText('Viewer')).toBeDefined();
  });

  it('renders security label', () => {
    render(<RoleBadge role="security" />);
    expect(screen.getByText('Security')).toBeDefined();
  });

  it('applies role-specific CSS class', () => {
    const { container } = render(<RoleBadge role="admin" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('text-signal');
  });
});
