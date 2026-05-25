import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'

interface TxnResult {
  decision: string; txn_id: string; risk_flags: string[];
  sender_hits: any[]; receiver_hits: any[];
  case_id: string; processing_ms: number;
}

export function TxnResultCard({ result }: { result: TxnResult }) {
  const isClear = result.decision === 'CLEAR'
  return (
    <Card>
      <div className="flex items-center justify-between mb-lg">
        <span className={`text-2xl font-bold ${isClear ? 'text-emerald-500' : 'text-red-500'}`}>
          {result.decision}
        </span>
        <span className="sf-caption" style={{ color: 'var(--dash-text-tertiary)' }}>
          {result.processing_ms}ms
        </span>
      </div>
      {result.risk_flags?.length > 0 && (
        <div className="flex flex-wrap gap-sm mb-lg">
          {result.risk_flags.map(f => <Badge key={f} color="red" size="sm">{f}</Badge>)}
        </div>
      )}
      {result.case_id && (
        <div className="p-md bg-amber-500/10 border border-amber-500/20 rounded-apple-md mb-lg">
          <p className="sf-caption text-amber-500">
            Case auto-created: <strong>{result.case_id}</strong>
          </p>
        </div>
      )}
      {result.sender_hits?.length > 0 && <HitsSection title="Sender Matches" hits={result.sender_hits} />}
      {result.receiver_hits?.length > 0 && <HitsSection title="Receiver Matches" hits={result.receiver_hits} />}
      {isClear && (
        <div className="text-center py-lg">
          <p className="sf-headline text-emerald-500 mt-sm">Transaction cleared</p>
        </div>
      )}
    </Card>
  )
}

function HitsSection({ title, hits }: { title: string; hits: any[] }) {
  return (
    <div className="mb-lg">
      <p className="sf-caption mb-sm" style={{ color: 'var(--dash-text-secondary)' }}>{title}</p>
      {hits.map((h: any, i: number) => (
        <div key={i} className="p-md bg-red-500/5 border border-red-500/10 rounded-apple-md mb-sm">
          <p className="sf-headline">{h.entity_name}</p>
          <div className="flex gap-sm mt-xs">
            <Badge color="red" size="sm">{h.list_id}</Badge>
            <Badge color="orange" size="sm">{Math.round((h.confidence ?? 0) * 100)}%</Badge>
          </div>
        </div>
      ))}
    </div>
  )
}
