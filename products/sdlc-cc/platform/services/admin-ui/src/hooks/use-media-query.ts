'use client'

import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia(query)
    setMatches(mediaQuery.matches)

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
    // Older browsers
    else {
      mediaQuery.addListener(handleChange)
      return () => mediaQuery.removeListener(handleChange)
    }
  }, [query])

  return matches
}

// Predefined media query hooks
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 768px)')
}

export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 769px) and (max-width: 1024px)')
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1025px)')
}

export function useIsDarkMode(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)')
}

export function useIsReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

export function useIsHighContrast(): boolean {
  return useMediaQuery('(prefers-contrast: high)')
}

// Hook for responsive breakpoint values
export function useBreakpoint(): 'sm' | 'md' | 'lg' | 'xl' | '2xl' {
  const isSm = useMediaQuery('(min-width: 640px)')
  const isMd = useMediaQuery('(min-width: 768px)')
  const isLg = useMediaQuery('(min-width: 1024px)')
  const isXl = useMediaQuery('(min-width: 1280px)')
  const is2Xl = useMediaQuery('(min-width: 1536px)')

  if (is2Xl) return '2xl'
  if (isXl) return 'xl'
  if (isLg) return 'lg'
  if (isMd) return 'md'
  if (isSm) return 'sm'
  return 'sm'
}

// Hook for responsive value based on breakpoint
export function useResponsiveValue<T>(values: {
  sm: T
  md?: T
  lg?: T
  xl?: T
  '2xl'?: T
}): T {
  const breakpoint = useBreakpoint()

  // Return the value for the current breakpoint or fallback to smaller breakpoint
  if (breakpoint === '2xl' && values['2xl'] !== undefined) return values['2xl']
  if (breakpoint === 'xl' && values.xl !== undefined) return values.xl
  if (breakpoint === 'lg' && values.lg !== undefined) return values.lg
  if (breakpoint === 'md' && values.md !== undefined) return values.md
  return values.sm
}
