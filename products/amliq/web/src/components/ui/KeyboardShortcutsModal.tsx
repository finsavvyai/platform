import React from 'react'

interface ShortcutRowProps {
  keys: string[]
  label: string
}

function ShortcutRow({ keys, label }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm" style={{ color: 'var(--dash-text-secondary)' }}>{label}</span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-xs mx-0.5" style={{ color: 'var(--dash-text-secondary)' }}>then</span>}
            <kbd className="px-2 py-0.5 rounded text-xs font-mono font-medium"
              style={{ background: 'var(--dash-bg)', border: '1px solid var(--dash-border)', color: 'var(--dash-text)' }}>
              {k}
            </kbd>
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

interface SectionProps {
  title: string
  children: React.ReactNode
}

function Section({ title, children }: SectionProps) {
  return (
    <div className="mb-5">
      <h4 className="text-xs font-semibold uppercase tracking-wider mb-2"
        style={{ color: 'var(--dash-text-secondary)' }}>
        {title}
      </h4>
      <div style={{ borderTop: '1px solid var(--dash-border)' }}>
        {children}
      </div>
    </div>
  )
}

interface KeyboardShortcutsModalProps {
  open: boolean
  onClose: () => void
}

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-md rounded-xl overflow-hidden shadow-lg"
        style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--dash-border)' }}>
          <h3 className="text-base font-semibold" style={{ color: 'var(--dash-text)' }}>
            Keyboard Shortcuts
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-lg leading-none cursor-pointer"
            style={{ color: 'var(--dash-text-secondary)' }}
            aria-label="Close keyboard shortcuts"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto max-h-[70vh]">
          <Section title="Navigation">
            <ShortcutRow keys={['G', 'A']} label="Go to Alerts" />
            <ShortcutRow keys={['G', 'S']} label="Go to Screen Entity" />
            <ShortcutRow keys={['G', 'D']} label="Go to Dashboard" />
          </Section>

          <Section title="Alert Queue">
            <ShortcutRow keys={['J']} label="Next alert" />
            <ShortcutRow keys={['K']} label="Previous alert" />
            <ShortcutRow keys={['Enter']} label="Open selected alert" />
          </Section>

          <Section title="Actions">
            <ShortcutRow keys={['R']} label="Resolve alert" />
            <ShortcutRow keys={['E']} label="Escalate alert" />
            <ShortcutRow keys={['?']} label="Toggle this help" />
          </Section>
        </div>
      </div>
    </div>
  )
}
