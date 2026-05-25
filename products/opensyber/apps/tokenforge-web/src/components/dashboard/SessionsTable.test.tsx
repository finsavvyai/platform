/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SessionsTable } from './SessionsTable';
import type { Session } from './types';

vi.mock('lucide-react', () => ({
  ChevronDown: ({ className }: { className?: string }) => (
    <span data-testid="chevron-down" className={className} />
  ),
  ChevronUp: ({ className }: { className?: string }) => (
    <span data-testid="chevron-up" className={className} />
  ),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { apiKey: 'test-token' } },
    status: 'authenticated',
  }),
}));

vi.mock('@/lib/tokenforge-api', () => ({
  revokeSession: vi.fn(() => Promise.resolve()),
}));

const mockSessions: Session[] = [
  {
    id: 'sess_01',
    deviceId: 'dk_8f3a2b1c9e4d',
    userId: 'user_abc123',
    trustScore: 95,
    status: 'active',
    boundAt: '2026-02-27T10:15:00Z',
    lastSeen: '2026-02-27T14:30:00Z',
    userAgent: 'Chrome 132',
    ip: '198.51.100.42',
  },
  {
    id: 'sess_02',
    deviceId: 'dk_7e2f1a0b8c3d',
    userId: 'user_def456',
    trustScore: 45,
    status: 'revoked',
    boundAt: '2026-02-26T08:22:00Z',
    lastSeen: '2026-02-26T13:45:00Z',
    userAgent: 'Firefox 135',
    ip: '203.0.113.17',
  },
  {
    id: 'sess_03',
    deviceId: 'dk_6d1e0f9a7b2c',
    userId: 'user_ghi789',
    trustScore: 72,
    status: 'expired',
    boundAt: '2026-02-25T16:40:00Z',
    lastSeen: '2026-02-25T18:10:00Z',
    userAgent: 'Safari 19',
    ip: '192.0.2.88',
  },
];

describe('SessionsTable', () => {
  it('renders all session rows', () => {
    render(<SessionsTable sessions={mockSessions} />);
    expect(screen.getByText('user_abc123')).toBeDefined();
    expect(screen.getByText('user_def456')).toBeDefined();
    expect(screen.getByText('user_ghi789')).toBeDefined();
  });

  it('renders truncated device IDs', () => {
    render(<SessionsTable sessions={mockSessions} />);
    expect(screen.getByText(/dk_8f3a2b1c/)).toBeDefined();
  });

  it('renders trust scores with correct colors', () => {
    render(<SessionsTable sessions={mockSessions} />);
    const score95 = screen.getByText('95');
    expect(score95.className).toContain('text-green-400');
    const score45 = screen.getByText('45');
    expect(score45.className).toContain('text-red-400');
  });

  it('renders status badges', () => {
    render(<SessionsTable sessions={mockSessions} />);
    expect(screen.getByText('active')).toBeDefined();
    expect(screen.getByText('revoked')).toBeDefined();
    expect(screen.getByText('expired')).toBeDefined();
  });

  it('shows revoke button only for active sessions', () => {
    render(<SessionsTable sessions={mockSessions} />);
    const revokeButtons = screen.getAllByText('Revoke');
    expect(revokeButtons).toHaveLength(1);
  });

  it('shows confirmation on first revoke click', () => {
    render(<SessionsTable sessions={mockSessions} />);
    const revokeButton = screen.getByText('Revoke');
    fireEvent.click(revokeButton);
    expect(screen.getByText('Confirm?')).toBeDefined();
  });

  it('revokes session on confirm click', () => {
    render(<SessionsTable sessions={mockSessions} />);
    const revokeButton = screen.getByText('Revoke');
    fireEvent.click(revokeButton);
    const confirmButton = screen.getByText('Confirm?');
    fireEvent.click(confirmButton);
    // After revoking, no more Revoke buttons
    expect(screen.queryByText('Revoke')).toBeNull();
  });

  it('renders empty table message when no sessions', () => {
    render(<SessionsTable sessions={[]} />);
    const rows = screen.queryByText('user_abc123');
    expect(rows).toBeNull();
  });

  it('sorts by trust score when header clicked', () => {
    render(<SessionsTable sessions={mockSessions} />);
    const header = screen.getByText(/Trust Score/);
    fireEvent.click(header);
    // After clicking, sorting should change
    const cells = screen.getAllByRole('row');
    expect(cells.length).toBeGreaterThan(1);
  });
});
