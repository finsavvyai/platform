'use client'

import { useState, useEffect, useCallback } from 'react'
import type { UseLocalStorageResult } from '@/types'

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): UseLocalStorageResult<T> {
  // Get initial value from localStorage or use provided initial value
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue
    }

    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  // Update localStorage when value changes
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        // Allow value to be a function so we have the same API as useState
        const valueToStore = value instanceof Function ? value(storedValue) : value
        setStoredValue(valueToStore)

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore))
        }
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error)
      }
    },
    [key, storedValue]
  )

  // Remove value from localStorage
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue)
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key)
      }
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error)
    }
  }, [key, initialValue])

  // Listen for changes to localStorage from other tabs/windows
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue))
        } catch (error) {
          console.error(`Error parsing localStorage value for key "${key}":`, error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [key])

  return { value: storedValue, setValue, removeValue }
}

// Hook for sessionStorage
export function useSessionStorage<T>(
  key: string,
  initialValue: T
): UseLocalStorageResult<T> {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue
    }

    try {
      const item = window.sessionStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error(`Error reading sessionStorage key "${key}":`, error)
      return initialValue
    }
  })

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value
        setStoredValue(valueToStore)

        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(key, JSON.stringify(valueToStore))
        }
      } catch (error) {
        console.error(`Error setting sessionStorage key "${key}":`, error)
      }
    },
    [key, storedValue]
  )

  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue)
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(key)
      }
    } catch (error) {
      console.error(`Error removing sessionStorage key "${key}":`, error)
    }
  }, [key, initialValue])

  return { value: storedValue, setValue, removeValue }
}

// Hook for managing complex objects in localStorage with versioning
export function useVersionedLocalStorage<T>(
  key: string,
  initialValue: T,
  version: number = 1
): UseLocalStorageResult<T> {
  const versionedKey = `${key}_v${version}`

  const { value, setValue, removeValue } = useLocalStorage(versionedKey, initialValue)

  // Migration logic when version changes
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      // Check if there's data from an older version
      const keys = Object.keys(window.localStorage)
      const olderVersionKey = keys.find(k => k.startsWith(`${key}_v`) && k !== versionedKey)

      if (olderVersionKey) {
        const olderData = window.localStorage.getItem(olderVersionKey)
        if (olderData) {
          // Migrate data to new version
          setValue(JSON.parse(olderData))
          // Remove old version data
          window.localStorage.removeItem(olderVersionKey)
        }
      }
    } catch (error) {
      console.error(`Error migrating localStorage data for key "${key}":`, error)
    }
  }, [key, versionedKey, setValue])

  return { value, setValue, removeValue }
}
