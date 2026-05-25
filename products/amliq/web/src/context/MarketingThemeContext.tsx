import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'

export type MarketingTheme = 'marketing' | 'midnight' | 'dark' | 'light'

interface Ctx {
  theme: MarketingTheme
  setTheme: (t: MarketingTheme) => void
  cycle: () => void
}

const ORDER: MarketingTheme[] = ['marketing', 'midnight', 'dark', 'light']
const KEY = 'amliq-marketing-theme'

const MarketingThemeContext = createContext<Ctx>({
  theme: 'marketing',
  setTheme: () => {},
  cycle: () => {},
})

function read(): MarketingTheme {
  if (typeof window === 'undefined') return 'marketing'
  const saved = localStorage.getItem(KEY) as MarketingTheme | null
  return saved && ORDER.includes(saved) ? saved : 'marketing'
}

export function MarketingThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<MarketingTheme>(read)

  useEffect(() => {
    try { localStorage.setItem(KEY, theme) } catch {}
  }, [theme])

  const setTheme = useCallback((t: MarketingTheme) => setThemeState(t), [])
  const cycle = useCallback(() => {
    setThemeState(prev => ORDER[(ORDER.indexOf(prev) + 1) % ORDER.length])
  }, [])

  return (
    <MarketingThemeContext.Provider value={{ theme, setTheme, cycle }}>
      {children}
    </MarketingThemeContext.Provider>
  )
}

export const useMarketingTheme = () => useContext(MarketingThemeContext)
export const MARKETING_THEMES = ORDER
