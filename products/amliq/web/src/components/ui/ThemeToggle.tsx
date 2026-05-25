import { Sun, Moon, Sparkles } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

export function ThemeToggle() {
  const { theme, cycle } = useTheme()

  const icons = {
    light: <Moon className="w-4 h-4" style={{ color: 'var(--dash-text-secondary)' }} />,
    dark: <Sun className="w-4 h-4" style={{ color: '#C9A96E' }} />,
    midnight: <Sun className="w-4 h-4" style={{ color: '#C9A96E' }} />,
    marketing: <Sparkles className="w-4 h-4" style={{ color: '#C9A96E' }} />,
  }

  const labels = {
    light: 'Switch to dark mode',
    dark: 'Switch to midnight mode',
    midnight: 'Switch to marketing theme',
    marketing: 'Switch to light mode',
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className="w-9 h-9 flex items-center justify-center rounded-xl
        hover:bg-[var(--dash-surface-hover)] border border-[var(--dash-border)]
        transition-all duration-200 cursor-pointer active:scale-90"
      style={{ background: 'var(--dash-surface)' }}
      aria-label={labels[theme]}
    >
      {icons[theme]}
    </button>
  )
}
