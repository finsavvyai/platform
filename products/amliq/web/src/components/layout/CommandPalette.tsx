import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { navSections, canAccess } from './navItems'
import { useAuth } from '../../context/AuthContext'

interface Props {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null!)
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = user?.role ?? 'viewer'

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        open ? onClose() : onClose() // toggle handled by parent
      }
      if (e.key === 'Escape' && open) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const allItems = navSections
    .filter((s) => canAccess(role, s.minRole))
    .flatMap((s) => s.items.filter((i) => canAccess(role, i.minRole)))

  const filtered = query
    ? allItems.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))
    : allItems

  const go = (path: string) => {
    navigate(path)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg rounded-apple-lg shadow-2xl overflow-hidden"
        style={{ background: 'var(--dash-bg-secondary)', border: '0.5px solid var(--dash-border)' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-md px-lg" style={{ borderBottom: '0.5px solid var(--dash-border)' }}>
          <Search className="w-4 h-4 text-apple-label-tertiary" />
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages..." className="flex-1 py-lg bg-transparent text-sm outline-none"
            style={{ color: 'var(--dash-text)' }} />
          <kbd className="text-[10px] text-apple-label-tertiary px-1.5 py-0.5 rounded"
            style={{ background: 'var(--dash-surface)' }}>ESC</kbd>
        </div>
        <div className="max-h-64 overflow-y-auto py-sm">
          {filtered.map(({ icon: Icon, label, path }) => (
            <button key={path} onClick={() => go(path)}
              className="w-full flex items-center gap-md px-lg py-md text-left cursor-pointer transition-colors"
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--dash-surface-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Icon className="w-4 h-4 text-apple-label-secondary" />
              <span className="text-sm" style={{ color: 'var(--dash-text)' }}>{label}</span>
              <span className="ml-auto text-[11px] text-apple-label-tertiary">{path}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-lg py-md text-sm text-apple-label-tertiary">No results</p>
          )}
        </div>
      </div>
    </div>
  )
}
