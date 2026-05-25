import { Sun, Moon, Sparkles, Star } from 'lucide-react'
import { useMarketingTheme, MARKETING_THEMES } from '../../context/MarketingThemeContext'
import type { MarketingTheme } from '../../context/MarketingThemeContext'

const META: Record<MarketingTheme, { label: string; Icon: typeof Sun }> = {
  marketing: { label: 'Brand', Icon: Sparkles },
  midnight: { label: 'Midnight', Icon: Star },
  dark: { label: 'Dark', Icon: Moon },
  light: { label: 'Light', Icon: Sun },
}

export default function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useMarketingTheme()
  const Active = META[theme].Icon

  if (compact) {
    return (
      <button
        type="button"
        aria-label={`Theme: ${META[theme].label}. Click to cycle.`}
        onClick={() => {
          const i = MARKETING_THEMES.indexOf(theme)
          setTheme(MARKETING_THEMES[(i + 1) % MARKETING_THEMES.length])
        }}
        className="inline-flex items-center justify-center w-9 h-9 rounded-[10px] cursor-pointer transition-all duration-200 hover:-translate-y-px"
        style={{
          background: 'var(--accent-light)',
          border: '1px solid var(--separator)',
          color: 'var(--text)',
        }}
      >
        <Active className="w-4 h-4" />
      </button>
    )
  }

  return (
    <div
      className="inline-flex items-center gap-1 p-1 rounded-[12px]"
      role="radiogroup"
      aria-label="Theme"
      style={{ background: 'var(--accent-light)', border: '1px solid var(--separator)' }}
    >
      {MARKETING_THEMES.map(t => {
        const { Icon, label } = META[t]
        const active = t === theme
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(t)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-[8px] cursor-pointer transition-all duration-200"
            style={{
              background: active ? 'var(--accent-gold)' : 'transparent',
              color: active ? '#0A0908' : 'var(--text-secondary)',
            }}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        )
      })}
    </div>
  )
}
