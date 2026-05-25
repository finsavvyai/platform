'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value)
  const lastRan = useRef(Date.now())

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value)
        lastRan.current = Date.now()
      }
    }, limit - (Date.now() - lastRan.current))

    return () => {
      clearTimeout(handler)
    }
  }, [value, limit])

  return throttledValue
}

// Hook for throttled callback (leading edge)
export function useThrottledCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  limit: number,
  deps: React.DependencyList = []
): T {
  // Initialise to 0 so the FIRST call always fires (leading edge).
  const lastRan = useRef(0)

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      if (Date.now() - lastRan.current >= limit) {
        callback(...args)
        lastRan.current = Date.now()
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [callback, limit, ...deps]
  ) as T

  return throttledCallback
}

// Hook for throttled value with leading edge execution
export function useThrottleLeading<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value)
  const lastExecuted = useRef<number>(Date.now())

  useEffect(() => {
    const now = Date.now()
    const timeSinceLastExecution = now - lastExecuted.current

    if (timeSinceLastExecution >= limit) {
      setThrottledValue(value)
      lastExecuted.current = now
      return undefined
    } else {
      const timer = setTimeout(() => {
        setThrottledValue(value)
        lastExecuted.current = Date.now()
      }, limit - timeSinceLastExecution)

      return () => clearTimeout(timer)
    }
  }, [value, limit])

  return throttledValue
}
