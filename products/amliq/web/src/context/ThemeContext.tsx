import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'midnight' | 'marketing'

interface ThemeCtx {
  theme: Theme
  setTheme: (t: Theme) => void
  cycle: () => void
}

const ThemeContext = createContext<ThemeCtx>({
  theme: 'light', setTheme: () => {}, cycle: () => {},
})

const THEMES: Theme[] = ['light', 'dark', 'midnight', 'marketing']
const STORAGE_KEY = 'amliq-theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light'
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (saved && THEMES.includes(saved)) return saved
    return 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.classList.toggle('dark', theme !== 'light')
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const setTheme = useCallback((t: Theme) => setThemeState(t), [])
  const cycle = useCallback(() => {
    setThemeState(prev => THEMES[(THEMES.indexOf(prev) + 1) % THEMES.length])
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
