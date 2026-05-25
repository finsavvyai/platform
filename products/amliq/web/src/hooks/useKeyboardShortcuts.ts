import { useEffect } from 'react'

export interface KeyboardShortcut {
  key: string
  meta?: boolean
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  handler: () => void
  description: string
}

const IGNORE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (IGNORE_TAGS.has(target.tagName) || target.isContentEditable) return

      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()
        const metaMatch = !!shortcut.meta === (e.metaKey || e.ctrlKey)
        const ctrlMatch = shortcut.ctrl === undefined || !!shortcut.ctrl === e.ctrlKey
        const shiftMatch = !!shortcut.shift === e.shiftKey
        const altMatch = !!shortcut.alt === e.altKey

        if (keyMatch && metaMatch && shiftMatch && altMatch && ctrlMatch) {
          e.preventDefault()
          shortcut.handler()
          break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}
