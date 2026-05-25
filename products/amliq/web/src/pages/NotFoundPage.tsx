import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Home } from 'lucide-react'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden"
      style={{ background: '#0D0C0A' }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(201,169,110,0.12) 0%, transparent 70%)',
        }}
      />

      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(201,169,110,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(201,169,110,0.8) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <div className="relative z-10 text-center max-w-lg">
        <div className="relative mb-2 select-none">
          <span
            className="block font-black leading-none"
            style={{
              fontSize: 'clamp(140px, 30vw, 220px)',
              color: 'transparent',
              WebkitTextStroke: '1px rgba(201,169,110,0.25)',
              letterSpacing: '-0.06em',
            }}
          >
            404
          </span>

          <span
            className="absolute inset-0 flex items-center justify-center font-black leading-none"
            style={{
              fontSize: 'clamp(140px, 30vw, 220px)',
              background: 'linear-gradient(135deg, #C9A96E 0%, #E8C98A 40%, #C9A96E 70%, #A8813E 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.06em',
              opacity: 0.15,
            }}
            aria-hidden="true"
          >
            404
          </span>
        </div>

        <div
          className="h-px w-16 mx-auto mb-8"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.5), transparent)' }}
        />

        <h1
          className="text-2xl sm:text-3xl font-semibold mb-3 tracking-tight"
          style={{ color: '#F0EDE7' }}
        >
          Page not found
        </h1>
        <p
          className="text-base mb-10 leading-relaxed"
          style={{ color: 'rgba(240,237,231,0.45)' }}
        >
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-[10px] cursor-pointer transition-all duration-200 hover:-translate-y-px"
            style={{
              background: 'rgba(240,237,231,0.06)',
              color: 'rgba(240,237,231,0.7)',
              border: '1px solid rgba(240,237,231,0.1)',
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Go back
          </button>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-[10px] cursor-pointer transition-all duration-200 hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(201,169,110,0.25)]"
            style={{ background: '#C9A96E', color: '#1A1814' }}
          >
            <Home className="w-4 h-4" />
            Back to home
          </button>
        </div>
      </div>

      <p
        className="absolute bottom-8 text-xs tracking-widest uppercase"
        style={{ color: 'rgba(240,237,231,0.2)' }}
      >
        AMLIQ
      </p>
    </div>
  )
}
