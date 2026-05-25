'use client';

import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { SuspendUserButton } from './SuspendUserButton';

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  isAdmin: boolean;
  isSuspended: boolean;
  createdAt: string;
}

interface UserTableProps {
  initialUsers: UserRow[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
}

export function UserTable({ initialUsers, initialNextCursor, initialHasMore }: UserTableProps) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/proxy/admin/users?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      setUsers(data.data ?? []);
      setCursor(data.nextCursor ?? null);
      setHasMore(data.hasMore ?? false);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const loadMore = async () => {
    if (!cursor) return;
    setLoading(true);
    try {
      const qs = search ? `search=${encodeURIComponent(search)}&cursor=${cursor}` : `cursor=${cursor}`;
      const res = await fetch(`/api/proxy/admin/users?${qs}`);
      const data = await res.json();
      setUsers((prev) => [...prev, ...(data.data ?? [])]);
      setCursor(data.nextCursor ?? null);
      setHasMore(data.hasMore ?? false);
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by name or email..."
            className="w-full rounded-lg border border-border bg-panel pl-10 pr-4 py-2.5 text-sm placeholder-neutral-600 focus:border-signal focus:outline-none"
          />
        </div>
        <button onClick={handleSearch} disabled={loading}
          className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-neutral-700 disabled:opacity-50">
          Search
        </button>
      </div>

      <div className="rounded border border-border bg-panel/30 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-secondary">
              <th className="px-6 py-3 font-medium">User</th>
              <th className="px-6 py-3 font-medium">Plan</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Joined</th>
              <th className="px-6 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/50">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-surface/30 transition">
                <td className="px-6 py-3">
                  <a href={`/admin/users/${user.id}`} className="text-signal hover:underline">
                    {user.name ?? user.email}
                  </a>
                  <p className="text-xs text-text-dim">{user.email}</p>
                </td>
                <td className="px-6 py-3 capitalize">{user.plan}</td>
                <td className="px-6 py-3">
                  {user.isSuspended
                    ? <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">Suspended</span>
                    : <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Active</span>}
                  {user.isAdmin && <span className="ml-1 text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">Admin</span>}
                </td>
                <td className="px-6 py-3 text-text-dim">{formatDate(user.createdAt)}</td>
                <td className="px-6 py-3">
                  <SuspendUserButton userId={user.id} isSuspended={user.isSuspended} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <button onClick={loadMore} disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-surface px-4 py-2 text-sm text-text-primary hover:bg-neutral-700 disabled:opacity-50">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Load More
        </button>
      )}
    </div>
  );
}
