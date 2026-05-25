import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { api } from '../../api/client'
import { ListSyncTable, type AuditRow } from '../../components/admin/ListSyncTable'

interface AuditResp { rows: AuditRow[]; count: number }

const STATUSES = ['', 'failed', 'ok', 'not_modified', 'skipped']

export function ListSyncHealth() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('failed')
  const [listId, setListId] = useState('')
  const [error, setError] = useState('')

  const fetchRows = async () => {
    setLoading(true); setError('')
    try {
      const qs = new URLSearchParams()
      if (status) qs.set('status', status)
      if (listId) qs.set('list_id', listId)
      qs.set('limit', '200')
      const r = await api.get<AuditResp>(`/admin/list-sync-audit?${qs}`)
      setRows(r.rows ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch failed')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchRows() }, [status, listId])

  const failed = rows.filter(r => r.status === 'failed').length
  const ok = rows.filter(r => r.status === 'ok').length

  return (
    <div>
      <PageHeader title="List Sync Health"
        description="Audit trail of every sanctions-list refresh attempt across tenants" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-lg mb-lg">
        <KpiCard title="Failed" value={failed} tone="red" />
        <KpiCard title="Succeeded" value={ok} tone="green" />
        <KpiCard title="Rows" value={rows.length} tone="neutral" />
      </div>
      <Card className="mb-lg">
        <div className="flex flex-wrap gap-md items-end">
          <Filter label="Status" value={status} setValue={setStatus}
            options={STATUSES.map(s => ({ v: s, l: s || 'any' }))} />
          <TextFilter label="List ID" value={listId} setValue={setListId} />
        </div>
      </Card>
      {loading ? <LoadingSpinner /> : <ListSyncTable rows={rows} />}
      {error && <Card className="mt-lg"><p className="text-red-500 sf-body">{error}</p></Card>}
    </div>
  )
}

function KpiCard({ title, value, tone }: { title: string; value: number; tone: 'red'|'green'|'neutral' }) {
  const color = tone === 'red' ? 'text-red-500' : tone === 'green' ? 'text-emerald-500' : ''
  return (
    <div className="glass-card p-lg rounded-apple-lg">
      <p className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>{title}</p>
      <p className={`sf-headline text-2xl ${color}`}>{value}</p>
    </div>
  )
}

function Filter({ label, value, setValue, options }: {
  label: string; value: string; setValue: (s: string) => void
  options: { v: string; l: string }[]
}) {
  return (
    <label className="flex flex-col">
      <span className="sf-caption mb-xs">{label}</span>
      <select value={value} onChange={e => setValue(e.target.value)}
        className="glass-input px-md py-sm rounded-apple">
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  )
}

function TextFilter({ label, value, setValue }: {
  label: string; value: string; setValue: (s: string) => void
}) {
  return (
    <label className="flex flex-col">
      <span className="sf-caption mb-xs">{label}</span>
      <input value={value} onChange={e => setValue(e.target.value)}
        placeholder="e.g. ofac_sdn" className="glass-input px-md py-sm rounded-apple" />
    </label>
  )
}

export default ListSyncHealth
