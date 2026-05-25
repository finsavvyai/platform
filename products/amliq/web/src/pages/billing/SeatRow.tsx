import React from 'react'
import { Seat } from '../../types/billing'
import { X } from 'lucide-react'

interface SeatRowProps { seat: Seat; onRemove: (userId: string) => void }

export function SeatRow({ seat, onRemove }: SeatRowProps) {
  const initials = (seat.email ?? '').split('@')[0].slice(0, 2).toUpperCase() || '??'

  return (
    <div className="flex items-center justify-between p-md rounded-apple-md transition-colors"
      style={{ background: 'var(--dash-surface)' }}>
      <div className="flex items-center gap-md">
        <div className="w-8 h-8 rounded-apple-md bg-indigo-600/20 flex items-center justify-center">
          <span className="text-xs font-medium text-indigo-600">{initials}</span>
        </div>
        <div>
          <p className="sf-body" style={{ color: 'var(--dash-text)' }}>{seat.email}</p>
          <p className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>{seat.role}</p>
        </div>
      </div>
      <button onClick={() => onRemove(seat.userId)}
        className="p-xs hover:bg-red-600/20 rounded-apple-md text-red-400 transition-colors min-h-[44px] cursor-pointer">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
