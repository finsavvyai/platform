import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getSeats, addSeat, removeSeat } from '../../api/billing'
import { SeatRow } from './SeatRow'
import { Seat } from '../../types/billing'
import { Plus } from 'lucide-react'

export function SeatManager() {
  const { t } = useTranslation('billing')
  const [seats, setSeats] = useState<Seat[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Investigator')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSeats()
      .then(data => setSeats(Array.isArray(data) ? data : []))
      .catch(() => setSeats([]))
      .finally(() => setLoading(false))
  }, [])

  const handleAdd = async () => {
    if (!email) return
    const newSeat = await addSeat(email, role)
    setSeats([...seats, newSeat]); setEmail(''); setRole('Investigator')
  }

  const handleRemove = async (userId: string) => {
    await removeSeat(userId)
    setSeats(seats.filter(s => s.userId !== userId))
  }

  if (loading) return <div className="sf-body" style={{ color: 'var(--dash-text-secondary)' }}>{t('seats.loading')}</div>

  return (
    <div className="space-y-md">
      <div className="flex flex-col sm:flex-row gap-xs">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder={t('seats.email_placeholder')} aria-label={t('seats.email_placeholder')}
          className="input-field flex-1" />
        <div className="flex gap-xs">
          <select value={role} onChange={e => setRole(e.target.value)}
            aria-label={t('seats.role')} className="input-field flex-1 sm:flex-none">
            <option>{t('seats.investigator')}</option>
            <option>{t('seats.analyst')}</option>
            <option>{t('seats.manager')}</option>
          </select>
          <button onClick={handleAdd} aria-label={t('seats.add')}
            className="button-primary flex items-center gap-xs min-h-[44px]">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="space-y-xs">
        {seats.map(seat => <SeatRow key={seat.userId} seat={seat} onRemove={handleRemove} />)}
      </div>
      <p className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>
        {t('seats.used', { current: seats.length, total: 3 })}
      </p>
    </div>
  )
}
