import { Badge } from '../ui/Badge'

interface APIKey {
  id: string; product: string; prefix: string;
  rate_limit: number; created_at: string; revoked: boolean;
}

export function KeyRow({ apiKey, onRevoke }: { apiKey: APIKey; onRevoke: (id: string) => void }) {
  return (
    <div className="flex items-center justify-between px-lg py-md border-b last:border-0"
      style={{ borderColor: 'var(--dash-border)' }}>
      <div>
        <code className="text-sm font-mono" style={{ color: 'var(--dash-text)' }}>{apiKey.prefix}</code>
        <p className="sf-caption mt-xs" style={{ color: 'var(--dash-text-tertiary)' }}>
          {new Date(apiKey.created_at).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center gap-md">
        <Badge color="purple" size="sm">{apiKey.product}</Badge>
        {apiKey.revoked ? (
          <Badge color="red" size="sm">Revoked</Badge>
        ) : (
          <button onClick={() => onRevoke(apiKey.id)}
            className="text-apple-red/60 hover:text-apple-red text-sm cursor-pointer">Revoke</button>
        )}
      </div>
    </div>
  )
}
