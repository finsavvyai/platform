import React, { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { fetchApi } from '../api/client'
import { useAuth } from '../context/AuthContext'

// Per-tenant sanctions-list settings. Mandatory lists (OFAC, UN, EU,
// UK, OpenSanctions default) are always on — checkbox is disabled.
// Everything else the tenant admin can toggle, reschedule, retune.

type ListRow = {
  list_id: string
  parser_type: string
  mandatory: boolean
  sync_enabled: boolean
  sync_schedule: string
  threshold: number
}

export function SanctionsListsSettings() {
  const { user } = useAuth()
  const tenantId = user?.tenant_id ?? ''
  const [rows, setRows] = useState<ListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!tenantId) return
    fetchApi<ListRow[]>(`/admin/tenants/${tenantId}/lists`)
      .then(setRows)
      .catch(e => setMsg(`Error: ${e.message}`))
      .finally(() => setLoading(false))
  }, [tenantId])

  const patch = (id: string, p: Partial<ListRow>) =>
    setRows(rs => rs.map(r => (r.list_id === id ? { ...r, ...p } : r)))

  const save = useCallback(async () => {
    setSaving(true); setMsg('')
    try {
      const payload = {
        lists: rows.map(r => ({
          list_id: r.list_id, parser_type: r.parser_type,
          sync_enabled: r.sync_enabled, sync_schedule: r.sync_schedule,
          threshold: r.threshold,
        })),
      }
      const next = await fetchApi<ListRow[]>(
        `/admin/tenants/${tenantId}/lists`,
        { method: 'PUT', body: JSON.stringify(payload) },
      )
      setRows(next)
      setMsg('Saved.')
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      setMsg(`Error: ${m}`)
    } finally {
      setSaving(false)
    }
  }, [rows, tenantId])

  if (loading) {
    return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>
  }

  return (
    <div>
      <PageHeader title="Sanctions List Settings"
        description="Mandatory lists are always on. Toggle discretionary ones and tune cadence or match threshold." />
      <div className="space-y-sm">
        {rows.map(r => (
          <div key={r.list_id} className="flex items-center gap-md p-sm rounded-lg border border-apple-gray-5">
            <div className="flex-1">
              <div className="sf-body font-medium">{r.list_id}</div>
              <div className="sf-caption text-apple-gray-1">{r.parser_type}</div>
              {r.mandatory && <span className="sf-caption text-apple-blue">Mandatory</span>}
            </div>
            <label className="flex items-center gap-xs sf-caption">
              <input type="checkbox" disabled={r.mandatory} checked={r.sync_enabled}
                onChange={e => patch(r.list_id, { sync_enabled: e.target.checked })} />
              Sync
            </label>
            <input className="border rounded px-sm py-xs font-mono text-xs w-32"
              value={r.sync_schedule} aria-label={`${r.list_id} cron`}
              onChange={e => patch(r.list_id, { sync_schedule: e.target.value })} />
            <input type="number" step={0.01} min={0} max={1}
              className="border rounded px-sm py-xs w-20"
              value={r.threshold} aria-label={`${r.list_id} threshold`}
              onChange={e => patch(r.list_id, { threshold: +e.target.value })} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-sm mt-md">
        <Button variant="primary" size="sm" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        {msg && (
          <span className={`sf-caption ${msg.startsWith('Error') ? 'text-apple-red' : 'text-apple-green'}`}>{msg}</span>
        )}
      </div>
    </div>
  )
}
