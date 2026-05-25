'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useApiKey } from '@/lib/use-api';
import { revokeSession } from '@/lib/tokenforge-api';
import type { Session } from './types';

const statusStyles: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400',
  revoked: 'bg-red-500/10 text-red-400',
  expired: 'bg-amber-500/10 text-amber-400',
};

function trustColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type SortField = 'trustScore' | 'boundAt' | 'status';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 10;

interface SessionsTableProps {
  sessions: Session[];
  onRevoke?: () => void;
}

export function SessionsTable({ sessions, onRevoke }: SessionsTableProps): React.ReactElement {
  const token = useApiKey();
  const [sortField, setSortField] = useState<SortField>('boundAt');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [page, setPage] = useState(0);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [items, setItems] = useState(sessions);

  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'trustScore') return (a.trustScore - b.trustScore) * dir;
      if (sortField === 'status') return a.status.localeCompare(b.status) * dir;
      return (new Date(a.boundAt).getTime() - new Date(b.boundAt).getTime()) * dir;
    });
    return arr;
  }, [items, sortField, sortDir]);

  const pageItems = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

  function toggleSort(field: SortField): void {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  async function handleRevoke(id: string): Promise<void> {
    if (revoking === id) {
      if (!token) {
        setRevoking(null);
        return;
      }
      try {
        await revokeSession(token, id);
        setItems((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status: 'revoked' as const } : s)),
        );
        onRevoke?.();
      } catch (err) {
        alert('Failed to revoke session. Please try again.');
        console.error('Session revoke failed:', err);
      }
      setRevoking(null);
    } else {
      setRevoking(id);
    }
  }

  const ariaSortValue = (field: SortField): 'ascending' | 'descending' | 'none' =>
    sortField !== field ? 'none' : sortDir === 'asc' ? 'ascending' : 'descending';

  const handleHeaderKeyDown = (e: React.KeyboardEvent, field: SortField): void => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort(field); }
  };

  const renderSortIcon = (field: SortField): React.ReactElement | null => {
    if (sortField !== field) return null;
    const Icon = sortDir === 'asc' ? ChevronUp : ChevronDown;
    return <Icon className="inline h-3 w-3" />;
  };

  return (
    <div className="rounded-xl border border-border bg-panel overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-muted">
            <th className="px-4 py-3 font-medium">Device ID</th>
            <th className="px-4 py-3 font-medium">User ID</th>
            <th
              className="cursor-pointer px-4 py-3 font-medium hover:text-text-primary"
              role="button"
              tabIndex={0}
              aria-sort={ariaSortValue('trustScore')}
              onClick={() => toggleSort('trustScore')}
              onKeyDown={(e) => handleHeaderKeyDown(e, 'trustScore')}
            >
              Trust Score {renderSortIcon('trustScore')}
            </th>
            <th
              className="cursor-pointer px-4 py-3 font-medium hover:text-text-primary"
              role="button"
              tabIndex={0}
              aria-sort={ariaSortValue('status')}
              onClick={() => toggleSort('status')}
              onKeyDown={(e) => handleHeaderKeyDown(e, 'status')}
            >
              Status {renderSortIcon('status')}
            </th>
            <th
              className="cursor-pointer px-4 py-3 font-medium hover:text-text-primary"
              role="button"
              tabIndex={0}
              aria-sort={ariaSortValue('boundAt')}
              onClick={() => toggleSort('boundAt')}
              onKeyDown={(e) => handleHeaderKeyDown(e, 'boundAt')}
            >
              Bound At {renderSortIcon('boundAt')}
            </th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {pageItems.map((s) => (
            <tr key={s.id} className="hover:bg-surface/40 transition">
              <td className="px-4 py-3 font-mono text-xs">{s.deviceId.slice(0, 12)}...</td>
              <td className="px-4 py-3 text-text-secondary">{s.userId}</td>
              <td className={`px-4 py-3 font-medium ${trustColor(s.trustScore)}`}>{s.trustScore}</td>
              <td className="px-4 py-3">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusStyles[s.status]}`}>
                  {s.status}
                </span>
              </td>
              <td className="px-4 py-3 text-text-secondary">{formatDate(s.boundAt)}</td>
              <td className="px-4 py-3">
                {s.status === 'active' ? (
                  <button
                    onClick={() => handleRevoke(s.id)}
                    className="rounded-lg bg-red-600/10 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-600/20 transition"
                  >
                    {revoking === s.id ? 'Confirm?' : 'Revoke'}
                  </button>
                ) : (
                  <span className="text-xs text-text-muted">&mdash;</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-lg px-3 py-1 text-sm text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-xs text-text-muted">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-lg px-3 py-1 text-sm text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
