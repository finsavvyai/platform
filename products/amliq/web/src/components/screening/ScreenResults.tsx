import { Card } from '../ui/Card'
import { ScreeningResultRow } from './ScreeningResultRow'
import { ShareResults } from './ShareResults'
import type { ScreenResponse } from '../../types'

export type { ScreenResponse }

interface Props {
  data: ScreenResponse
}

export function ScreenResults({ data }: Props) {
  const matches = data.matches ?? []
  const totalMatches = data.total_matches ?? matches.length

  if (totalMatches === 0) {
    return (
      <Card className="text-center py-xxl">
        <div className="text-apple-green text-3xl mb-md">&#10003;</div>
        <p className="sf-headline text-apple-green">No Matches Found</p>
        <p className="sf-caption mt-sm">
          No sanctions matches for &ldquo;{data.query}&rdquo;
        </p>
        <div className="mt-lg flex justify-center">
          <ShareResults data={data} />
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-md">
      <div className="flex items-center justify-between">
        <p className="sf-body">
          <span className="sf-headline">{totalMatches}</span> matches
        </p>
        <div className="flex items-center gap-md">
          <span className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>
            {data.processing_time_ms ?? 0}ms
          </span>
          <ShareResults data={data} />
        </div>
      </div>
      {matches.map((m, i) => (
        <ScreeningResultRow key={m.entity_id} match={m} index={i} />
      ))}
    </div>
  )
}
