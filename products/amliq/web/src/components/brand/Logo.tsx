interface Props {
  size?: number
  showText?: boolean
  className?: string
  variant?: 'dark' | 'light'
}

function Mark({ size, variant }: { size: number; variant: 'dark' | 'light' }) {
  const isLight = variant === 'light'
  const bgFill = isLight ? '#FFFFFF' : '#0F172A'
  const shieldStroke = isLight ? '#0F172A' : '#FFFFFF'
  const radarStroke = isLight ? '#0F172A' : '#FFFFFF'
  const accent = '#C9A96E'

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill={bgFill} />
      <path
        d="M16 5.5 L24 8.2 V15.2 C24 20.1 20.6 24.2 16 25.8 C11.4 24.2 8 20.1 8 15.2 V8.2 Z"
        stroke={shieldStroke} strokeWidth="1.8" strokeLinejoin="round" fill="none"
      />
      <circle cx="16" cy="15" r="4.8" stroke={radarStroke} strokeWidth="1.3" opacity="0.35" fill="none" />
      <circle cx="16" cy="15" r="2.8" stroke={radarStroke} strokeWidth="1.3" opacity="0.6" fill="none" />
      <circle cx="16" cy="15" r="1.2" fill={accent} />
      <path
        d="M19.4 18.4 L22 21"
        stroke={accent} strokeWidth="1.8" strokeLinecap="round"
      />
    </svg>
  )
}

export default function Logo({ size = 28, showText = true, className = '', variant = 'dark' }: Props) {
  return (
    <a href="/" className={`flex items-center gap-2 group ${className}`}>
      <Mark size={size} variant={variant} />
      {showText && (
        <span className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
          AMLIQ
        </span>
      )}
    </a>
  )
}

export function LogoIcon({ size = 20, variant = 'dark' }: { size?: number; variant?: 'dark' | 'light' }) {
  return <Mark size={size} variant={variant} />
}

export function LogoGradientDefs() {
  return null
}
