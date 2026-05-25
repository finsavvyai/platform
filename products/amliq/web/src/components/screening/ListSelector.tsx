import React from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'

const LISTS = [
  { id: 'OFAC', label: 'OFAC SDN', color: 'red' as const },
  { id: 'EU', label: 'EU Consolidated', color: 'blue' as const },
  { id: 'UN', label: 'UN Consolidated', color: 'blue' as const },
  { id: 'UKOFSI', label: 'UK OFSI', color: 'purple' as const },
  { id: 'SECO', label: 'SECO', color: 'orange' as const },
  { id: 'IsraeliMoD', label: 'Israeli MoD', color: 'orange' as const },
  { id: 'SDFM', label: 'SDFM Ukraine', color: 'orange' as const },
]

interface ListSelectorProps {
  selected: string[]
  onChange: (lists: string[]) => void
}

export function ListSelector({ selected, onChange }: ListSelectorProps) {
  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id],
    )
  }

  const allSelected = selected.length === LISTS.length

  return (
    <Card>
      <div className="flex items-center justify-between mb-md">
        <h3 className="sf-headline">Sanctions Lists</h3>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onChange(allSelected ? [] : LISTS.map((l) => l.id))}
        >
          {allSelected ? 'Clear All' : 'Select All'}
        </Button>
      </div>
      <div className="space-y-sm">
        {LISTS.map((list) => (
          <label
            key={list.id}
            className="flex items-center gap-md cursor-pointer py-xs"
          >
            <input
              type="checkbox"
              checked={selected.includes(list.id)}
              onChange={() => toggle(list.id)}
              className="accent-[#C9A96E] w-4 h-4"
            />
            <Badge color={list.color} size="sm">
              {list.label}
            </Badge>
          </label>
        ))}
      </div>
    </Card>
  )
}
