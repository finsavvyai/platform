import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'

export interface AuditRow {
  ID: number
  TenantID: string
  ListID: string
  Status: string
  status?: string // json field fallback
  StartedAt: string
  FinishedAt: string
  DurationMS: number
  EntitiesBefore: number
  EntitiesAfter: number
  Delta: number
  FetchStrategy: string
  SourceBytes: number
  Error: string
  TriggeredBy: string
}

const statusColor = (s: string): 'red' | 'green' | 'gray' | 'orange' => {
  if (s === 'failed') return 'red'
  if (s === 'ok') return 'green'
  if (s === 'skipped') return 'orange'
  return 'gray'
}

const fmtDate = (iso: string) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleString()
}

const fmtNum = (n: number) => (n ?? 0).toLocaleString()

export function ListSyncTable({ rows }: { rows: AuditRow[] }) {
  if (!rows.length) {
    return (
      <Card>
        <p className="sf-body text-center py-lg"
          style={{ color: 'var(--dash-text-secondary)' }}>
          No audit rows match the current filter.
        </p>
      </Card>
    )
  }
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>
              <th className="p-sm">Started</th>
              <th className="p-sm">List</th>
              <th className="p-sm">Tenant</th>
              <th className="p-sm">Status</th>
              <th className="p-sm">Δ</th>
              <th className="p-sm">Entities</th>
              <th className="p-sm">Strategy</th>
              <th className="p-sm">Triggered by</th>
              <th className="p-sm">Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.ID} className="border-t"
                style={{ borderColor: 'var(--dash-border)' }}>
                <td className="p-sm sf-caption whitespace-nowrap">
                  {fmtDate(r.StartedAt)}
                </td>
                <td className="p-sm sf-body font-semibold">{r.ListID}</td>
                <td className="p-sm sf-caption">{(r.TenantID || '').slice(0, 8)}</td>
                <td className="p-sm">
                  <Badge color={statusColor(r.Status)} size="sm">{r.Status}</Badge>
                </td>
                <td className="p-sm sf-caption">{fmtNum(r.Delta)}</td>
                <td className="p-sm sf-caption">
                  {fmtNum(r.EntitiesBefore)} → {fmtNum(r.EntitiesAfter)}
                </td>
                <td className="p-sm sf-caption">{r.FetchStrategy || '—'}</td>
                <td className="p-sm sf-caption">{r.TriggeredBy}</td>
                <td className="p-sm sf-caption text-red-500 max-w-xs truncate"
                  title={r.Error}>{r.Error || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
