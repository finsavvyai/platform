import React, { useEffect, useState } from 'react'

type Status = 'online' | 'offline' | 'restored'

export function NetworkStatusBanner() {
  const [status, setStatus] = useState<Status>('online')

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const handleOffline = () => {
      clearTimeout(timer)
      setStatus('offline')
    }

    const handleOnline = () => {
      setStatus('restored')
      timer = setTimeout(() => setStatus('online'), 3000)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      clearTimeout(timer)
    }
  }, [])

  if (status === 'online') return null

  const isOffline = status === 'offline'

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full py-1.5 px-4 text-center text-sm font-medium transition-colors"
      style={{
        background: isOffline ? '#92400e' : '#166534',
        color: '#fff',
        zIndex: 9999,
        position: 'relative',
      }}
    >
      {isOffline
        ? 'No internet connection — changes may not save'
        : 'Back online'}
    </div>
  )
}
