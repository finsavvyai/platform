'use client'

import { useState, useEffect, useCallback } from 'react'

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
export function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): T {
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      const timer = setTimeout(() => {
        callback(...args)
      }, delay)

      setDebounceTimer(timer)
    },
    [callback, delay, debounceTimer, ...deps]
  ) as T

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
    }
  }, [debounceTimer])

  return debouncedCallback
}

// Hook for debounced value with loading state
export function useDebouncedValue<T>(value: T, delay: number): {
  debouncedValue: T
  isDebouncing: boolean
} {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  const [isDebouncing, setIsDebouncing] = useState(false)

  useEffect(() => {
    setIsDebouncing(true)
    const handler = setTimeout(() => {
      setDebouncedValue(value)
      setIsDebouncing(false)
    }, delay)

    return () => {
      clearTimeout(handler)
      setIsDebouncing(false)
    }
  }, [value, delay])

  return { debouncedValue, isDebouncing }
}
