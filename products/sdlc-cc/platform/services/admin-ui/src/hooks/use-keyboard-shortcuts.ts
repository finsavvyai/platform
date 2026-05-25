'use client'

import { useEffect, useCallback } from 'react'

interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  metaKey?: boolean
  callback: () => void
  description?: string
  preventDefault?: boolean
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const {
          key,
          ctrlKey = false,
          altKey = false,
          shiftKey = false,
          metaKey = false,
          callback,
          preventDefault = true,
        } = shortcut

        if (
          event.key.toLowerCase() === key.toLowerCase() &&
          event.ctrlKey === ctrlKey &&
          event.altKey === altKey &&
          event.shiftKey === shiftKey &&
          event.metaKey === metaKey
        ) {
          if (preventDefault) {
            event.preventDefault()
          }
          callback()
          break
        }
      }
    },
    [shortcuts]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return shortcuts
}

// Hook for single keyboard shortcut
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: Omit<KeyboardShortcut, 'key' | 'callback'> = {}
) {
  return useKeyboardShortcuts([
    {
      key,
      callback,
      ...options,
    },
  ])
}

// Hook for common shortcuts
export function useCommonShortcuts() {
  const shortcuts: KeyboardShortcut[] = [
    // Ctrl/Cmd + K for search
    {
      key: 'k',
      ctrlKey: true,
      callback: () => {
        // Focus search input
        const searchInput = document.querySelector('input[placeholder*="search"]') as HTMLInputElement
        searchInput?.focus()
      },
      description: 'Focus search',
    },
    // Escape to close modals
    {
      key: 'Escape',
      callback: () => {
        // Close any open modals
        const modal = document.querySelector('[data-state="open"]') as HTMLElement
        if (modal?.getAttribute('role') === 'dialog') {
          const closeButton = modal.querySelector('[data-state="open"] button[aria-label="Close"]') as HTMLButtonElement
          closeButton?.click()
        }
      },
      description: 'Close modal',
    },
    // Ctrl/Cmd + / for keyboard shortcuts help
    {
      key: '/',
      ctrlKey: true,
      callback: () => {
        // Show keyboard shortcuts help
        console.log('Show keyboard shortcuts help')
      },
      description: 'Show shortcuts',
    },
  ]

  return useKeyboardShortcuts(shortcuts)
}
