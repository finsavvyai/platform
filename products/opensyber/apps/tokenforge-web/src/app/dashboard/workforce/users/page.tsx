'use client';

import { useCallback, useState } from 'react';
import { Users, Download } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { fetchSubjects, type Subject } from '@/lib/tokenforge-api-workforce';

export default function WorkforceUsersPage(): React.ReactElement {
  const fetcher = useCallback(
    (token: string, signal: AbortSignal) => fetchSubjects(token, signal),
    [],
  );
  const { data: subjects, loading } = useApi<Subject[]>(fetcher);
  const [search, setSearch] = useState('');

  const filtered = (subjects ?? []).filter((s) => {
    const q = search.toLowerCase();
    return (
      (s.email?.toLowerCase().includes(q) ?? false) ||
      (s.name?.toLowerCase().includes(q) ?? false) ||
      s.externalSubject.toLowerCase().includes(q)
    );
  });

  function exportCsv(): void {
    const rows = [
      ['ID', 'Email', 'Name', 'External ID', 'First Seen', 'Last Seen'],
      ...filtered.map((s) => [
        s.id, s.email ?? '', s.name ?? '', s.externalSubject, s.firstSeenAt, s.lastSeenAt,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'workforce-users.csv';
    a.click();
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workforce Users</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Users authenticated via OIDC IdP and bound with DBSC
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 rounded-lg bg-surface px-4 py-2 text-sm hover:bg-surface/80 transition disabled:opacity-40"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      <input
        placeholder="Search by name, email, or external ID..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-6 w-full rounded-lg border border-border/50 bg-panel px-4 py-2.5 text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-info"
      />

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl border border-border/50 bg-panel" />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-panel/20 p-16 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-info/10">
            <Users className="h-8 w-8 text-info" />
          </div>
          <h2 className="mb-2 text-xl font-semibold">No users yet</h2>
          <p className="max-w-md text-sm text-text-secondary">
            Users appear after completing the SSO exchange flow via a
            workforce IdP app.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/50 bg-panel">
          <table className="w-full text-sm">
            <thead className="border-b border-border/50 bg-surface/40 text-left text-xs uppercase tracking-wider text-text-tertiary">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">External ID</th>
                <th className="px-4 py-3">First Seen</th>
                <th className="px-4 py-3">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-surface/20 transition">
                  <td className="px-4 py-3 font-mono text-xs">{s.email ?? '--'}</td>
                  <td className="px-4 py-3">{s.name ?? '--'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                    {s.externalSubject.slice(0, 16)}...
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {new Date(s.firstSeenAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {new Date(s.lastSeenAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
