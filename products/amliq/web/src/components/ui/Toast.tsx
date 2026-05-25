import React, { useState, useCallback, createContext, useContext } from 'react'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'

type ToastType = 'success' | 'error' | 'info'
interface ToastItem { id: number; message: string; type: ToastType }

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })
export const useToast = () => useContext(ToastContext)

let nextId = 0

const icons: Record<ToastType, typeof Info> = {
  success: CheckCircle, error: AlertCircle, info: Info,
}

const accents: Record<ToastType, string> = {
  success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-[#C9A96E]',
}

const iconBg: Record<ToastType, string> = {
  success: 'rgba(45,122,79,0.12)', error: 'rgba(192,57,43,0.12)', info: 'rgba(201,169,110,0.12)',
}

const iconColors: Record<ToastType, string> = {
  success: 'text-emerald-600', error: 'text-red-600', info: 'text-[#C9A96E]',
}

function ToastEntry({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const isRtl = document.documentElement.dir === 'rtl'
  const Icon = icons[item.type]

  return (
    <motion.div
      key={item.id}
      role="alert"
      layout
      initial={{ opacity: 0, x: isRtl ? -100 : 100, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: isRtl ? -80 : 80, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 360, damping: 32 }}
      className="flex items-start gap-3 px-4 py-3 rounded-xl backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.4)] text-sm"
      style={{ overflow: 'hidden', position: 'relative', background: 'var(--dash-bg-secondary)', border: '0.5px solid var(--dash-border)' }}
    >
      <div className={clsx('absolute inset-block-0 inset-inline-start-0 w-[3px] rounded-ss-xl rounded-es-xl', accents[item.type])} />
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: iconBg[item.type] }}>
        <Icon className={clsx('w-4 h-4', iconColors[item.type])} />
      </div>
      <p className="flex-1 leading-relaxed" style={{ color: 'var(--dash-text)' }}>{item.message}</p>
      <motion.button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="transition-colors cursor-pointer mt-0.5"
        style={{ color: 'var(--dash-text-tertiary)' }}
        whileHover={{ scale: 1.2, color: 'var(--dash-text)' }}
        whileTap={{ scale: 0.9 }}
      >
        <X className="w-3.5 h-3.5" />
      </motion.button>
    </motion.div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const isRtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl'

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId++
    setItems(prev => [...prev, { id, message, type }])
    setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const dismiss = (id: number) => setItems(prev => prev.filter(t => t.id !== id))

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className={clsx('fixed bottom-4 z-50 space-y-2 max-w-sm w-full px-4', isRtl ? 'left-0' : 'right-0')}
        style={{ maxWidth: 360 }}
        aria-live="polite"
      >
        <AnimatePresence mode="popLayout">
          {items.map(item => (
            <ToastEntry key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
