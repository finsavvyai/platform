import React from 'react'
import clsx from 'clsx'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'destructive' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open, title, message,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'primary', onConfirm, onCancel,
}: ConfirmModalProps) {
  if (!open) return null

  const confirmBtn = variant === 'destructive'
    ? 'bg-red-600 text-white hover:bg-red-700'
    : 'bg-[#1A1814] text-white hover:bg-[#2C2A25]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md rounded-xl overflow-hidden shadow-lg"
        style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)' }}
        onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--dash-text)' }}>{title}</h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--dash-text-secondary)' }}>{message}</p>
        </div>
        <div className="flex gap-3 p-4" style={{ borderTop: '1px solid var(--dash-border)' }}>
          <button type="button" onClick={onCancel}
            className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all"
            style={{ color: 'var(--dash-text-secondary)', border: '1px solid var(--dash-border)' }}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm}
            className={clsx('flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all', confirmBtn)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
