import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'

interface LoadedSource {
  list_id: string
  count: number
}

export function SourcesTable({ sources }: { sources: LoadedSource[] }) {
  return (
    <Card>
      <h3 className="sf-headline mb-lg">Loaded Sources</h3>
      <div className="space-y-sm">
        {sources.map(s => (
          <div key={s.list_id}
            className="flex items-center justify-between p-md rounded-apple-md"
            style={{ background: 'var(--dash-surface)' }}>
            <div className="flex items-center gap-md">
              <Badge color={s.list_id.startsWith('ofac') ? 'red' : 'orange'} size="sm">
                {s.list_id}
              </Badge>
            </div>
            <span className="sf-body font-semibold">{s.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
