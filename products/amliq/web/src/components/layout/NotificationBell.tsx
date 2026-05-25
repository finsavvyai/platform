import { useState, useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'
import { api } from '../../api/client'

interface Notification {
  id: string
  action: string
  details: string
  created_at: string
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const ref = useRef<HTMLDivElement>(null!)

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function fetchNotifications() {
    try {
      const data = await api.get<{ entries: Notification[]; total: number }>('/audit?limit=10')
      setItems(data.entries ?? [])
      setUnread(data.total > 0 ? Math.min(data.total, 9) : 0)
    } catch { /* silent */ }
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => { setOpen(!open); setUnread(0) }}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl
          transition-all cursor-pointer active:scale-90"
        style={{ ['--tw-bg-opacity' as string]: 1 }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--dash-surface-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        <Bell className="w-5 h-5 text-apple-label-secondary" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4
            bg-gradient-to-br from-red-500 to-rose-600 rounded-full
            text-[10px] text-white flex items-center justify-center font-bold
            shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 max-w-[90vw] rounded-2xl overflow-hidden z-50
          backdrop-blur-xl
          shadow-[0_16px_50px_rgba(0,0,0,0.5)]"
          style={{ background: 'var(--dash-bg-secondary)', border: '0.5px solid var(--dash-border)' }}>
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--dash-border)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>Notifications</p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {items.length === 0 && (
              <p className="p-6 text-sm text-apple-label-tertiary text-center">
                No notifications
              </p>
            )}
            {items.map(n => <NotifRow key={n.id} item={n} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function NotifRow({ item }: { item: Notification }) {
  const time = new Date(item.created_at).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  return (
    <div className="px-4 py-3 transition-colors cursor-pointer"
      style={{ borderBottom: '0.5px solid var(--dash-border)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--dash-surface-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      <p className="text-sm leading-snug" style={{ color: 'var(--dash-text)' }}>{item.action}</p>
      <p className="text-[11px] text-apple-label-tertiary mt-1">{time}</p>
    </div>
  )
}
