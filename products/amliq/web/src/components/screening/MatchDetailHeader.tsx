import { Badge } from '../ui/Badge'
import { ConfidenceScore } from '../data/ConfidenceScore'
import type { ScreenMatch } from '../../types'

const listColors: Record<string, 'red' | 'blue' | 'purple' | 'orange' | 'green' | 'gray'> = {
  OFAC: 'red',
  EU: 'blue',
  UN: 'purple',
  UKOFSI: 'orange',
  SECO: 'green',
  SDFM: 'gray',
  NBCTF: 'gray',
  IsraeliMoD: 'gray',
}

function getListColor(listId: string): 'red' | 'blue' | 'purple' | 'orange' | 'green' | 'gray' {
  const upper = listId.toUpperCase()
  for (const [key, color] of Object.entries(listColors)) {
    if (upper.startsWith(key.toUpperCase())) return color
  }
  return 'gray'
}

const typeIcons: Record<string, string> = {
  Individual: '\u{1F464}',
  Company: '\u{1F3E2}',
  Vessel: '\u{1F6A2}',
  Aircraft: '\u{2708}\u{FE0F}',
}

interface Props {
  match: ScreenMatch
}

export function MatchDetailHeader({ match }: Props) {
  const pct = Math.round(match.confidence * 100)
  const entityType = match.type ?? match.entity_type ?? 'Individual'
  const icon = typeIcons[entityType] ?? '\u{1F4CB}'

  return (
    <div className="flex items-start justify-between gap-md">
      <div className="flex-1 min-w-0">
        <h3 className="sf-headline text-lg truncate">{match.entity_name}</h3>
        <div className="flex flex-wrap gap-sm mt-sm">
          <Badge color="gray" size="sm">
            {icon} {entityType}
          </Badge>
          <Badge color={getListColor(match.list_id)} size="sm">
            {match.list_id}
          </Badge>
          {match.disposition && (
            <Badge
              color={match.disposition === 'AutoEscalate' ? 'red' : 'orange'}
              size="sm"
            >
              {match.disposition}
            </Badge>
          )}
        </div>
      </div>
      <ConfidenceScore score={pct} size="md" />
    </div>
  )
}
