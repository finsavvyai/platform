import { useState, useEffect } from 'react'

const themes = [
  { id: 'midnight', label: 'Midnight', color: '#10b981' },
  { id: 'cyberpunk', label: 'Cyberpunk', color: '#ff00ff' },
  { id: 'ocean', label: 'Ocean', color: '#3b82f6' },
  { id: 'ember', label: 'Ember', color: '#f97316' },
  { id: 'matrix', label: 'Matrix', color: '#00ff41' },
]

export default function ThemeSwitcher() {
  const [current, setCurrent] = useState(() => localStorage.getItem('pushci-theme') || 'midnight')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', current)
    localStorage.setItem('pushci-theme', current)
  }, [current])

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface-card hover:bg-surface-hover transition-all text-xs text-zinc-400"
      >
        <span className="w-3 h-3 rounded-full" style={{ background: themes.find(t => t.id === current)?.color }} />
        Theme
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-40 rounded-xl border border-surface-border bg-surface-card/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-scale-in z-50">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => { setCurrent(t.id); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                current === t.id ? 'bg-surface-hover text-white' : 'text-zinc-400 hover:bg-surface-hover hover:text-zinc-200'
              }`}
            >
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: t.color }} />
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
