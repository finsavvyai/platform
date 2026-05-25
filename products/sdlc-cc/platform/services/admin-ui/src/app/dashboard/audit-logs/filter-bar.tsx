'use client'

/**
 * Day 13: filter bar for the audit-logs page. Extracted into its own
 * file to keep page.tsx under the 200-LOC cap.
 */

import { FormEvent } from 'react'

export type AuditFilters = {
  actor_id: string
  action: string
  from: string
  to: string
  tenant_id: string
}

export const blankAuditFilters: AuditFilters = {
  actor_id: '',
  action: '',
  from: '',
  to: '',
  tenant_id: '',
}

export interface FilterBarProps {
  filters: AuditFilters
  onChange: (next: AuditFilters) => void
  onSubmit: () => void
  onReset: () => void
  onExport: () => void
  loading: boolean
}

export function FilterBar(props: FilterBarProps) {
  const { filters, onChange, onSubmit, onReset, onExport, loading } = props
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onSubmit()
  }
  const set = <K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) =>
    onChange({ ...filters, [key]: value })

  return (
    <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
      <input
        aria-label="actor_id"
        placeholder="Actor UUID"
        value={filters.actor_id}
        onChange={(e) => set('actor_id', e.target.value)}
        className="rounded border px-2 py-1 text-sm"
      />
      <input
        aria-label="action"
        placeholder="Action (e.g. policy.update)"
        value={filters.action}
        onChange={(e) => set('action', e.target.value)}
        className="rounded border px-2 py-1 text-sm"
      />
      <input
        aria-label="tenant_id"
        placeholder="Tenant UUID"
        value={filters.tenant_id}
        onChange={(e) => set('tenant_id', e.target.value)}
        className="rounded border px-2 py-1 text-sm"
      />
      <input
        type="datetime-local"
        aria-label="from"
        value={filters.from}
        onChange={(e) => set('from', e.target.value)}
        className="rounded border px-2 py-1 text-sm"
      />
      <input
        type="datetime-local"
        aria-label="to"
        value={filters.to}
        onChange={(e) => set('to', e.target.value)}
        className="rounded border px-2 py-1 text-sm"
      />
      <div className="col-span-2 md:col-span-5 flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          {loading ? 'Querying…' : 'Apply filters'}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded border px-3 py-1 text-sm"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onExport}
          className="rounded border px-3 py-1 text-sm"
        >
          Export CSV
        </button>
      </div>
    </form>
  )
}
