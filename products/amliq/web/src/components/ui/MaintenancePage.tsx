import { RefreshCw, Wifi } from 'lucide-react'

interface MaintenancePageProps {
  onRetry: () => void
}

export function MaintenancePage({ onRetry }: MaintenancePageProps) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <div className="w-full max-w-md text-center">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-8"
          style={{ background: 'rgba(201,169,110,0.1)' }}
        >
          <Wifi className="w-7 h-7" style={{ color: '#C9A96E' }} />
        </div>

        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
          style={{
            background: 'rgba(201,169,110,0.1)',
            color: '#C9A96E',
            border: '1px solid rgba(201,169,110,0.2)',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: '#C9A96E' }}
          />
          Service interruption detected
        </div>

        <h1
          className="text-2xl font-semibold tracking-tight mb-3"
          style={{ color: 'var(--text)' }}
        >
          We'll be right back
        </h1>

        <p
          className="text-sm leading-relaxed mb-10"
          style={{ color: 'var(--text-secondary)', maxWidth: '320px', margin: '0 auto 2.5rem' }}
        >
          AMLIQ is temporarily unavailable. Our team has been notified and is working to restore
          service. Please try again in a moment.
        </p>

        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-[10px] cursor-pointer transition-all duration-150"
          style={{
            background: '#1A1814',
            color: '#C9A96E',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = '#2C2A25'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = '#1A1814'
          }}
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>

        <p
          className="text-xs mt-8"
          style={{ color: 'var(--text-tertiary)' }}
        >
          If this persists, contact{' '}
          <a
            href="mailto:support@amliq.finance"
            className="underline underline-offset-2 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            support@amliq.finance
          </a>
        </p>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.3), transparent)' }}
      />
    </div>
  )
}
