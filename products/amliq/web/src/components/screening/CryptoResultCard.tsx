import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'

interface CryptoHit {
  address: string; chain: string; entity_id: string;
  list_id: string; source: string;
}

interface CryptoResult {
  decision: string; wallet_address: string; chain: string;
  hits: CryptoHit[]; risk_flags: string[]; processing_us: number;
}

export function CryptoResultCard({ result }: { result: CryptoResult }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-lg">
        <div className="flex items-center gap-md">
          <span className={`text-2xl font-bold ${
            result.decision === 'CLEAR' ? 'text-emerald-500' : 'text-red-500'
          }`}>
            {result.decision}
          </span>
          <Badge color={result.decision === 'CLEAR' ? 'green' : 'red'} size="sm">
            {result.chain}
          </Badge>
        </div>
        <span className="sf-caption" style={{ color: 'var(--dash-text-tertiary)' }}>
          {result.processing_us ?? 0}us
        </span>
      </div>
      <code className="text-sm font-mono block mb-lg break-all"
        style={{ color: 'var(--dash-text-secondary)' }}>
        {result.wallet_address}
      </code>
      {(result.risk_flags ?? []).length > 0 && (
        <div className="flex flex-wrap gap-sm mb-lg">
          {result.risk_flags.map(f => <Badge key={f} color="red" size="sm">{f}</Badge>)}
        </div>
      )}
      {(result.hits ?? []).length > 0 && (
        <div>
          <p className="sf-caption mb-sm" style={{ color: 'var(--dash-text-tertiary)' }}>
            Sanctions Matches
          </p>
          {result.hits.map((h, i) => (
            <div key={i} className="p-md bg-red-500/5 border border-red-500/10 rounded-apple-md mb-sm">
              <code className="text-sm font-mono break-all"
                style={{ color: 'var(--dash-text)' }}>{h.address}</code>
              <div className="flex gap-sm mt-xs">
                <Badge color="red" size="sm">{h.list_id}</Badge>
                <Badge color="orange" size="sm">{h.chain}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
      {(result.hits ?? []).length === 0 && result.decision === 'CLEAR' && (
        <div className="text-center py-lg">
          <p className="sf-headline text-emerald-500 mt-sm">No sanctions matches</p>
        </div>
      )}
    </Card>
  )
}
