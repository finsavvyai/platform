/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PendingInvitations } from './PendingInvitations';

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

const invitations = [
  { id: 'i1', email: 'a@ex.com', role: 'developer' as const, expiresAt: '2026-12-31', status: 'pending' },
  { id: 'i2', email: 'b@ex.com', role: 'viewer' as const, expiresAt: '2026-12-31', status: 'accepted' },
  { id: 'i3', email: 'c@ex.com', role: 'admin' as const, expiresAt: '2026-12-31', status: 'pending' },
];

describe('PendingInvitations', () => {
  it('returns null when no pending invitations', () => {
    const { container } = render(
      <PendingInvitations orgId="org1" invitations={[]} canManage={true} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('filters out non-pending invitations', () => {
    render(
      <PendingInvitations orgId="org1" invitations={invitations} canManage={false} />,
    );
    expect(screen.getByText('a@ex.com')).toBeDefined();
    expect(screen.getByText('c@ex.com')).toBeDefined();
    expect(screen.queryByText('b@ex.com')).toBeNull();
  });

  it('renders section title', () => {
    render(
      <PendingInvitations orgId="org1" invitations={invitations} canManage={false} />,
    );
    expect(screen.getByText('Pending Invitations')).toBeDefined();
  });

  it('shows Cancel column when canManage is true', () => {
    render(
      <PendingInvitations orgId="org1" invitations={invitations} canManage={true} />,
    );
    expect(screen.getByText('Cancel')).toBeDefined();
  });

  it('hides Cancel column when canManage is false', () => {
    render(
      <PendingInvitations orgId="org1" invitations={invitations} canManage={false} />,
    );
    expect(screen.queryByText('Cancel')).toBeNull();
  });

  it('shows role badges for pending invitations', () => {
    render(
      <PendingInvitations orgId="org1" invitations={invitations} canManage={false} />,
    );
    expect(screen.getByText('Developer')).toBeDefined();
    expect(screen.getByText('Admin')).toBeDefined();
  });
});
