/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserTable } from './UserTable';

vi.mock('@/lib/utils', () => ({
  formatDate: (d: string) => d,
}));

const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

beforeEach(() => {
  vi.restoreAllMocks();
  mockReload.mockClear();
  global.fetch = vi.fn();
});

const users = [
  { id: 'u1', email: 'alice@ex.com', name: 'Alice', plan: 'pro', isAdmin: false, isSuspended: false, createdAt: '2026-01-01' },
  { id: 'u2', email: 'bob@ex.com', name: null, plan: 'free', isAdmin: true, isSuspended: true, createdAt: '2026-02-01' },
];

describe('UserTable', () => {
  it('renders table headers', () => {
    render(<UserTable initialUsers={users} initialNextCursor={null} initialHasMore={false} />);
    expect(screen.getByText('User')).toBeDefined();
    expect(screen.getByText('Plan')).toBeDefined();
    expect(screen.getByText('Status')).toBeDefined();
    expect(screen.getByText('Joined')).toBeDefined();
    expect(screen.getByText('Actions')).toBeDefined();
  });

  it('renders user rows', () => {
    render(<UserTable initialUsers={users} initialNextCursor={null} initialHasMore={false} />);
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getAllByText('alice@ex.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('bob@ex.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('pro')).toBeDefined();
  });

  it('shows Active and Suspended badges', () => {
    render(<UserTable initialUsers={users} initialNextCursor={null} initialHasMore={false} />);
    expect(screen.getByText('Active')).toBeDefined();
    expect(screen.getByText('Suspended')).toBeDefined();
  });

  it('shows Admin badge for admin users', () => {
    render(<UserTable initialUsers={users} initialNextCursor={null} initialHasMore={false} />);
    expect(screen.getByText('Admin')).toBeDefined();
  });

  it('renders search input and button', () => {
    render(<UserTable initialUsers={users} initialNextCursor={null} initialHasMore={false} />);
    expect(screen.getByPlaceholderText('Search by name or email...')).toBeDefined();
    expect(screen.getByText('Search')).toBeDefined();
  });

  it('shows Load More button when hasMore is true', () => {
    render(<UserTable initialUsers={users} initialNextCursor="c1" initialHasMore={true} />);
    expect(screen.getByText('Load More')).toBeDefined();
  });

  it('hides Load More button when hasMore is false', () => {
    render(<UserTable initialUsers={users} initialNextCursor={null} initialHasMore={false} />);
    expect(screen.queryByText('Load More')).toBeNull();
  });

  it('calls search API on search button click', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], nextCursor: null, hasMore: false }),
    } as unknown as Response);

    render(<UserTable initialUsers={users} initialNextCursor={null} initialHasMore={false} />);
    fireEvent.change(screen.getByPlaceholderText('Search by name or email...'), {
      target: { value: 'alice' },
    });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/admin/users?search=alice',
      );
    });
  });

  it('links to user detail page', () => {
    render(<UserTable initialUsers={users} initialNextCursor={null} initialHasMore={false} />);
    const link = screen.getByText('Alice').closest('a');
    expect(link?.getAttribute('href')).toBe('/admin/users/u1');
  });
});
