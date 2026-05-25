'use client'

/**
 * Day 13: audit-log query UI.
 *
 * Filter by actor, action, tenant, and time window; paginate via the
 * server-issued cursor; export the current filter set as CSV. Calls
 * the gateway handler at GET /admin/audit-logs (admin_audit.go).
 *
 * Styling matches the rate-limits page (./tenants/[id]/rate-limits)
 * to keep the admin surface visually cohesive without pulling in the
 * heavier zustand-backed user-management components. The filter form
 * lives in ./filter-bar.tsx so page.tsx stays under the 200-LOC cap.
 */

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import {
  FilterBar,
  blankAuditFilters,
  type AuditFilters,
} from './filter-bar'

type AuditRow = {
  id: string
  tenant_id: string
  actor_id?: string
  actor_type: string
  action: string
  target_type?: string
  target_id?: string
  ip_address?: string
  user_agent?: string
  created_at: string
}

type AuditPage = {
  rows: AuditRow[]
  next_cursor?: string
}

const PAGE_LIMIT = 50

function buildQuery(filters: AuditFilters, cursor: string | null): string {
  const params = new URLSearchParams()
  if (filters.actor_id) params.set('actor_id', filters.actor_id)
  if (filters.action) params.set('action', filters.action)
  if (filters.from) params.set('from', new Date(filters.from).toISOString())
  if (filters.to) params.set('to', new Date(filters.to).toISOString())
  if (filters.tenant_id) params.set('tenant_id', filters.tenant_id)
  params.set('limit', String(PAGE_LIMIT))
  if (cursor) params.set('cursor', cursor)
  return params.toString()
}

export default function AuditLogsPage() {
  const [filters, setFilters] = useState<AuditFilters>(blankAuditFilters)
  const [rows, setRows] = useState<AuditRow[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPage = async (next: string | null = null) => {
    setLoading(true)
    setError(null)
    try {
      const qs = buildQuery(filters, next)
      const resp = await apiClient.get<AuditPage>(`/admin/audit-logs?${qs}`)
      setRows((prev) => (next ? [...prev, ...resp.rows] : resp.rows))
      setNextCursor(resp.next_cursor ?? null)
    } catch (e) {
      setError(`Query failed: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPage(null)
    // first-load only; subsequent fetches go through the form / cursor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onExport = () => {
    const qs = buildQuery(filters, null)
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/admin/audit-logs?${qs}`, {
      headers: { Accept: 'text/csv' },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `audit-logs-${new Date().toISOString()}.csv`
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch((e) => setError(`Export failed: ${(e as Error).message}`))
  }

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight">Audit logs</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Filter by actor, action, and time range. Results are HMAC-signed
        and append-only (migration 009).
      </p>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </div>
      )}

      <FilterBar
        filters={filters}
        onChange={setFilters}
        onSubmit={() => {
          setRows([])
          fetchPage(null)
        }}
        onReset={() => {
          setFilters(blankAuditFilters)
          setRows([])
          fetchPage(null)
        }}
        onExport={onExport}
        loading={loading}
      />

      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-2 py-2 text-left">Timestamp</th>
              <th className="px-2 py-2 text-left">Actor</th>
              <th className="px-2 py-2 text-left">Action</th>
              <th className="px-2 py-2 text-left">Target</th>
              <th className="px-2 py-2 text-left">IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-2 py-1 font-mono text-xs">
                  {new Date(row.created_at).toLocaleString()}
                </td>
                <td className="px-2 py-1 font-mono text-xs">
                  {row.actor_id ?? row.actor_type}
                </td>
                <td className="px-2 py-1">{row.action}</td>
                <td className="px-2 py-1 font-mono text-xs">
                  {row.target_type ? `${row.target_type}/${row.target_id}` : '—'}
                </td>
                <td className="px-2 py-1 font-mono text-xs">{row.ip_address ?? '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td className="px-2 py-4 text-center text-muted-foreground" colSpan={5}>
                  No rows for these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <button
          type="button"
          onClick={() => fetchPage(nextCursor)}
          disabled={loading}
          className="mt-4 rounded border px-3 py-1 text-sm"
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}
