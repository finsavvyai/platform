import { Card } from '../ui/Card'

interface SourcesData {
  loaded: Array<{ list_id: string; count: number }>
  total_entities: number
  total_peps: number
  total_profiles: number
  available_count: number
}

export function DataSourceStats({ data }: { data: SourcesData | null }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-lg mb-xl">
      <StatCard label="Total Entities" value={data?.total_entities ?? 0} />
      <StatCard label="PEP Profiles" value={data?.total_peps ?? 0} />
      <StatCard label="Total Profiles" value={data?.total_profiles ?? 0} accent />
      <StatCard label="Active Lists" value={data?.loaded?.length ?? 0} />
    </div>
  )
}

function StatCard({ label, value, accent }: {
  label: string; value: number; accent?: boolean
}) {
  const cls = accent ? 'text-indigo-600' : 'text-emerald-500'
  return (
    <Card>
      <p className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>{label}</p>
      <p className={`sf-headline text-2xl ${cls}`}>{value.toLocaleString()}</p>
    </Card>
  )
}
