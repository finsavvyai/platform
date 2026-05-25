/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemberTable } from './MemberTable';

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

const members = [
  { userId: 'u1', name: 'Alice', email: 'alice@ex.com', role: 'owner' as const, acceptedAt: '2026-01-01' },
  { userId: 'u2', name: null, email: 'bob@ex.com', role: 'developer' as const, acceptedAt: null },
];

describe('MemberTable', () => {
  it('renders table headers', () => {
    render(
      <MemberTable orgId="org1" ownerId="u1" members={members} currentUserRole="admin" canManage={true} />,
    );
    expect(screen.getByText('Name')).toBeDefined();
    expect(screen.getByText('Email')).toBeDefined();
    expect(screen.getByText('Role')).toBeDefined();
    expect(screen.getByText('Joined')).toBeDefined();
  });

  it('renders member names and emails', () => {
    render(
      <MemberTable orgId="org1" ownerId="u1" members={members} currentUserRole="admin" canManage={false} />,
    );
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('alice@ex.com')).toBeDefined();
    expect(screen.getByText('Unknown')).toBeDefined();
    expect(screen.getByText('bob@ex.com')).toBeDefined();
  });

  it('shows Pending for members without acceptedAt', () => {
    render(
      <MemberTable orgId="org1" ownerId="u1" members={members} currentUserRole="admin" canManage={false} />,
    );
    expect(screen.getByText('Pending')).toBeDefined();
  });

  it('shows Actions column when canManage is true', () => {
    render(
      <MemberTable orgId="org1" ownerId="u1" members={members} currentUserRole="admin" canManage={true} />,
    );
    expect(screen.getByText('Actions')).toBeDefined();
  });

  it('hides Actions column when canManage is false', () => {
    render(
      <MemberTable orgId="org1" ownerId="u1" members={members} currentUserRole="admin" canManage={false} />,
    );
    expect(screen.queryByText('Actions')).toBeNull();
  });

  it('shows RoleBadge when canManage is false', () => {
    render(
      <MemberTable orgId="org1" ownerId="u1" members={members} currentUserRole="admin" canManage={false} />,
    );
    expect(screen.getByText('Owner')).toBeDefined();
    expect(screen.getByText('Developer')).toBeDefined();
  });
});
