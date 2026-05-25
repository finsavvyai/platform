import React from 'react'

// AMLIQ V2 Design Tokens (exact spec)
// bg        #050B18   surface-card  #111827
// bg-2      #0A2540   border        rgba(255,255,255,0.08)
// surface   #0F172A   border-muted  rgba(255,255,255,0.05)
// gold      #C6A85A   gold-deep     #A88E45   gold-soft #E7D08A

export const tok = {
  bg: '#050B18',
  bg2: '#0A2540',
  surface: '#0F172A',
  card: '#111827',
  border: 'rgba(255,255,255,0.08)',
  borderMuted: 'rgba(255,255,255,0.05)',
  text: 'rgba(255,255,255,0.92)',
  textSec: 'rgba(255,255,255,0.72)',
  textMuted: 'rgba(255,255,255,0.55)',
  textDim: 'rgba(255,255,255,0.38)',
  gold: '#C6A85A',
  goldDeep: '#A88E45',
  goldSoft: '#E7D08A',
  success: '#22C55E',
  warning: '#F59E0B',
  critical: '#EF4444',
  info: '#3B82F6',
}

export function cx(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(' ')
}

export function Container({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cx('mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8', className)}>{children}</div>
  )
}

export function Section({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={cx('py-16 sm:py-20 lg:py-28', className)}>
      {children}
    </section>
  )
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = 'left',
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  align?: 'left' | 'center'
}) {
  return (
    <div className={cx('max-w-3xl', align === 'center' && 'mx-auto text-center')}>
      {eyebrow && (
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: tok.gold }}
        >
          {eyebrow}
        </div>
      )}
      <h2
        className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl"
        style={{ color: tok.text }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className="mt-4 text-sm leading-relaxed sm:text-base"
          style={{ color: tok.textSec }}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'md' | 'lg'
  as?: 'button' | 'a'
  href?: string
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  as = 'button',
  href,
  children,
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050B18] disabled:opacity-60 disabled:cursor-not-allowed'
  const sizes = {
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-5 text-sm',
  }
  const variants = {
    primary: 'text-[#050B18] hover:brightness-95',
    secondary: 'text-white/90 hover:bg-white/[0.04]',
    ghost: 'text-white/75 hover:text-white',
  }
  const style: React.CSSProperties =
    variant === 'primary'
      ? { background: tok.gold }
      : variant === 'secondary'
      ? { border: `1px solid ${tok.border}`, background: 'transparent' }
      : {}

  const cls = cx(base, sizes[size], variants[variant], className)
  if (as === 'a') {
    return (
      <a href={href} className={cls} style={style}>
        {children}
      </a>
    )
  }
  return (
    <button className={cls} style={style} {...rest}>
      {children}
    </button>
  )
}

export function Card({
  children,
  className = '',
  elevated,
}: {
  children: React.ReactNode
  className?: string
  elevated?: boolean
}) {
  return (
    <div
      className={cx('rounded-xl', className)}
      style={{
        background: elevated ? tok.surface : tok.card,
        border: `1px solid ${tok.border}`,
      }}
    >
      {children}
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'critical' | 'info' | 'gold'
  className?: string
}) {
  const tones: Record<string, React.CSSProperties> = {
    neutral: {
      background: 'rgba(255,255,255,0.04)',
      color: tok.textSec,
      border: `1px solid ${tok.border}`,
    },
    success: {
      background: 'rgba(34,197,94,0.1)',
      color: '#86EFAC',
      border: '1px solid rgba(34,197,94,0.22)',
    },
    warning: {
      background: 'rgba(245,158,11,0.1)',
      color: '#FCD34D',
      border: '1px solid rgba(245,158,11,0.22)',
    },
    critical: {
      background: 'rgba(239,68,68,0.1)',
      color: '#FCA5A5',
      border: '1px solid rgba(239,68,68,0.22)',
    },
    info: {
      background: 'rgba(59,130,246,0.1)',
      color: '#93C5FD',
      border: '1px solid rgba(59,130,246,0.22)',
    },
    gold: {
      background: 'rgba(198,168,90,0.1)',
      color: tok.goldSoft,
      border: `1px solid rgba(198,168,90,0.28)`,
    },
  }
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium tabular-nums',
        className,
      )}
      style={tones[tone]}
    >
      {children}
    </span>
  )
}

export function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
}) {
  return (
    <Card className="p-5">
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: tok.textMuted }}
      >
        {label}
      </div>
      <div
        className="mt-2 text-2xl font-semibold tabular-nums"
        style={{ color: accent ? tok.gold : tok.text }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-xs" style={{ color: tok.textMuted }}>
          {sub}
        </div>
      )}
    </Card>
  )
}

export function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ background: color, boxShadow: `0 0 0 3px ${color}22` }}
    />
  )
}

export function Divider({ className = '' }: { className?: string }) {
  return <div className={cx('h-px w-full', className)} style={{ background: tok.border }} />
}
