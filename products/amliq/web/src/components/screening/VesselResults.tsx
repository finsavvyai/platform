import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'

interface VesselMatch {
  match_id: string; vessel_name: string; list_source: string;
  confidence: number; rule_id: string; explanation: string;
  vessel_details: Record<string, unknown>;
}

function getConfidenceColor(score: number): 'red' | 'orange' | 'green' | 'gray' {
  if (score >= 0.95) return 'red'
  if (score >= 0.85) return 'orange'
  if (score >= 0.7) return 'green'
  return 'gray'
}

export function VesselResults({ results, vesselName }: {
  results: { matches: VesselMatch[]; total: number }
  vesselName: string
}) {
  return (
    <Card>
      <h3 className="sf-headline mb-md">
        Results -- {results.total} match{results.total !== 1 ? 'es' : ''}
      </h3>
      {results.total === 0 ? (
        <p className="sf-body" style={{ color: 'var(--dash-text-secondary)' }}>
          No matches found for "{vesselName}"
        </p>
      ) : (
        <div className="space-y-md">
          {results.matches.map((match, idx) => (
            <VesselMatchCard key={idx} match={match} />
          ))}
        </div>
      )}
    </Card>
  )
}

function VesselMatchCard({ match }: { match: VesselMatch }) {
  return (
    <div className="p-md rounded-apple-lg border"
      style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-surface)' }}>
      <div className="flex items-start justify-between mb-sm">
        <div className="flex-1">
          <p className="sf-body font-medium">{match.vessel_name}</p>
          <p className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>
            {match.list_source}
          </p>
        </div>
        <Badge color={getConfidenceColor(match.confidence)} size="sm">
          {(Math.round(match.confidence * 100) / 100).toFixed(2)}
        </Badge>
      </div>
      <p className="sf-caption mb-sm" style={{ color: 'var(--dash-text-secondary)' }}>
        {match.explanation}
      </p>
      {Object.keys(match.vessel_details).length > 0 && (
        <div className="mt-sm p-sm rounded-apple-md" style={{ background: 'var(--dash-surface)' }}>
          <p className="sf-caption font-medium mb-xs">Vessel Details:</p>
          <div className="grid grid-cols-2 gap-xs">
            {Object.entries(match.vessel_details).map(([key, value]) => (
              <div key={key}>
                <span className="sf-caption font-medium">{key}:</span>
                <span className="sf-caption ml-xs">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
