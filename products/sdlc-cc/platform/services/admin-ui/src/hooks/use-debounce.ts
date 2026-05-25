'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Hook for debounced callback
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): T {
  // Use refs so successive calls within a single render-cycle observe the
  // SAME timer reference (state would defer the update to the next render).
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        callback(...args)
        timerRef.current = null
      }, delay)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [callback, delay, ...deps]
  ) as T

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  return debouncedCallback
}

// Hook for debounced value with loading state
export function useDebouncedValue<T>(value: T, delay: number): {
  debouncedValue: T
  isDebouncing: boolean
} {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  const [isDebouncing, setIsDebouncing] = useState(false)
  const isFirstRun = useRef(true)

  useEffect(() => {
    // Don't flag the initial mount as "debouncing" — there's no pending change.
    if (isFirstRun.current) {
      isFirstRun.current = false
      return undefined
    }

    setIsDebouncing(true)
    const handler = setTimeout(() => {
      setDebouncedValue(value)
      setIsDebouncing(false)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return { debouncedValue, isDebouncing }
}
