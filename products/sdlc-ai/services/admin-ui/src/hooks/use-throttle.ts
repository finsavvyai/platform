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

// Hook for throttled callback
export function useThrottledCallback<T extends (...args: any[]) => void>(
  callback: T,
  limit: number,
  deps: React.DependencyList = []
): T {
  const lastRan = useRef(Date.now())

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      if (Date.now() - lastRan.current >= limit) {
        callback(...args)
        lastRan.current = Date.now()
      }
    },
    [callback, limit, lastRan.current, ...deps]
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
