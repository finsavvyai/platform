import { useState } from 'react'
import { Card } from '../ui/Card'
import { MatchDetailHeader } from './MatchDetailHeader'
import { MatchEntityInfo } from './MatchEntityInfo'
import { MatchEvidenceBars } from './MatchEvidenceBars'
import { MatchSanctionsInfo } from './MatchSanctionsInfo'
import { MatchContactInfo } from './MatchContactInfo'
import { MatchIdentifiers } from './MatchIdentifiers'
import { MatchMetadata } from './MatchMetadata'
import { MatchDetailSlideout } from './MatchDetailSlideout'
import type { ScreenMatch } from '../../types'

export type { ScreenMatch }

interface Props {
  match: ScreenMatch
  index?: number
}

function Divider() {
  return <div className="border-t pt-md" style={{ borderColor: 'var(--dash-border)' }} />
}

export function ScreeningResultRow({ match, index = 0 }: Props) {
  const [detailOpen, setDetailOpen] = useState(false)
  const delay = `${index * 60}ms`

  return (
    <>
      <div className="animate-fade-in" style={{ animationDelay: delay }}>
        <Card hover onClick={() => setDetailOpen(true)}>
          <div className="space-y-lg">
            <MatchDetailHeader match={match} />
            <Divider />
            <MatchEntityInfo match={match} />
            <Divider />
            <MatchEvidenceBars layers={match.layers} />
            {match.explanation && (
              <p className="sf-caption italic" style={{ color: 'var(--dash-text-tertiary)' }}>
                {match.explanation}
              </p>
            )}
          </div>
        </Card>
      </div>
      <MatchDetailSlideout match={match} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </>
  )
}
