import { useState, useEffect, useCallback } from 'react'
import { useLocalStorageState } from 'use-local-storage-state'
import { useDebounce } from 'use-debounce'

interface UseLocalStorageOptions {
  serializer?: {
    stringify: (value: any) => string
    parse: (value: string) => any
  }
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options?: UseLocalStorageOptions
) {
  const [storedValue, setStoredValue] = useLocalStorageState(key, {
    defaultValue: initialValue,
    ...options,
  })

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue as T) : value
      setStoredValue(valueToStore)
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error)
    }
  }, [key, setStoredValue, storedValue])

  return [storedValue, setValue] as const
}

export function useDebouncedValue<T>(value: T, delay: number): T {
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

export function useDebounceCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const [debouncedCallback] = useDebounce(callback, delay)

  return debouncedCallback as T
}

export function useViewport() {
  const [viewport, setViewport] = useState({
    width: 0,
    height: 0,
    isMobile: false,
    isTablet: false,
    isDesktop: false,
  })

  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth
      const height = window.innerHeight

      setViewport({
        width,
        height,
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024,
      })
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)

    return () => {
      window.removeEventListener('resize', updateViewport)
    }
  }, [])

  return viewport
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    setMatches(media.matches)

    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    media.addEventListener('change', listener)
    return () => {
      media.removeEventListener('change', listener)
    }
  }, [query])

  return matches
}

export function useOnScreen(
  ref: React.RefObject<Element>,
  rootMargin = '0px',
  threshold = 1.0
): boolean {
  const [isIntersecting, setIntersecting] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIntersecting(entry.isIntersecting)
      },
      {
        rootMargin,
        threshold,
      }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [ref, rootMargin, threshold])

  return isIntersecting
}

export function useClickOutside(
  ref: React.RefObject<HTMLElement>,
  handler: () => void
) {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [ref, handler])
}

export function useKeyboard shortcuts: Record<string, () => void>) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = []
      if (event.ctrlKey) key.push('ctrl')
      if (event.altKey) key.push('alt')
      if (event.shiftKey) key.push('shift')
      if (event.metaKey) key.push('meta')
      key.push(event.key.toLowerCase())

      const shortcut = key.join('+')
      const handler = shortcuts[shortcut]

      if (handler) {
        event.preventDefault()
        handler()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [shortcuts])
}

export function useCopyToClipboard(text: string, resetDelay = 2000) {
  const [isCopied, setIsCopied] = useState(false)

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setIsCopied(true)

      setTimeout(() => {
        setIsCopied(false)
      }, resetDelay)
    } catch (error) {
      console.error('Failed to copy text: ', error)
    }
  }, [text, resetDelay])

  return { isCopied, copy }
}

export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  dependencies: React.DependencyList = []
) {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let isCancelled = false

    const runAsync = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await asyncFunction()
        if (!isCancelled) {
          setData(result)
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err as Error)
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    runAsync()

    return () => {
      isCancelled = true
    }
  }, dependencies)

  return { data, isLoading, error }
}

export function useToggle(initialValue = false) {
  const [value, setValue] = useState(initialValue)

  const toggle = useCallback(() => {
    setValue(prev => !prev)
  }, [])

  const setTrue = useCallback(() => {
    setValue(true)
  }, [])

  const setFalse = useCallback(() => {
    setValue(false)
  }, [])

  return [value, toggle, setTrue, setFalse] as const
}

export function useArray<T>(initialValue: T[] = []) {
  const [array, setArray] = useState<T[]>(initialValue)

  const add = useCallback((item: T) => {
    setArray(prev => [...prev, item])
  }, [])

  const remove = useCallback((index: number) => {
    setArray(prev => prev.filter((_, i) => i !== index))
  }, [])

  const update = useCallback((index: number, item: T) => {
    setArray(prev => {
      const newArray = [...prev]
      newArray[index] = item
      return newArray
    })
  }, [])

  const clear = useCallback(() => {
    setArray([])
  }, [])

  return {
    array,
    setArray,
    add,
    remove,
    update,
    clear,
  }
}

export function useTimer(initialTime = 0, isRunning = false) {
  const [time, setTime] = useState(initialTime)
  const [isRunning, setIsRunning] = useState(isRunning)

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isRunning && time > 0) {
      interval = setInterval(() => {
        setTime(prev => prev - 1)
      }, 1000)
    } else if (time === 0) {
      setIsRunning(false)
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [isRunning, time])

  const start = useCallback(() => {
    setIsRunning(true)
  }, [])

  const pause = useCallback(() => {
    setIsRunning(false)
  }, [])

  const reset = useCallback(() => {
    setTime(initialTime)
    setIsRunning(false)
  }, [initialTime])

  return {
    time,
    isRunning,
    start,
    pause,
    reset,
  }
}