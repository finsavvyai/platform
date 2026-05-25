import { useState, useRef, useEffect } from 'react'
import { Download, FileSpreadsheet, FileText, FileJson } from 'lucide-react'
import clsx from 'clsx'

interface ExportOption {
  label: string
  format: string
  icon: typeof FileText
  gradient: string
}

const options: ExportOption[] = [
  { label: 'Export CSV', format: 'csv', icon: FileSpreadsheet, gradient: 'from-green-500 to-emerald-600' },
  { label: 'Export PDF', format: 'pdf', icon: FileText, gradient: 'from-red-500 to-rose-600' },
  { label: 'Export JSON', format: 'json', icon: FileJson, gradient: 'from-[#C9A96E] to-[#B8945A]' },
]

interface ExportMenuProps {
  onExport: (format: string) => void
  className?: string
}

export function ExportMenu({ onExport, className }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className={clsx('relative', className)}>
      <button type="button" onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
          text-apple-label-secondary
          transition-all cursor-pointer"
        style={{ border: '0.5px solid var(--dash-border)' }}>
        <Download className="w-4 h-4" />
        Export
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-xl overflow-hidden z-50
          backdrop-blur-xl
          shadow-[0_12px_40px_rgba(0,0,0,0.4)]
          animate-in fade-in slide-in-from-top-2 duration-200"
          style={{ background: 'var(--dash-bg-secondary)', border: '0.5px solid var(--dash-border)' }}>
          {options.map(opt => {
            const Icon = opt.icon
            return (
              <button key={opt.format} type="button"
                onClick={() => { onExport(opt.format); setOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-3
                  text-sm
                  transition-all cursor-pointer hover:scale-[1.01]"
                style={{ color: 'var(--dash-text-secondary)' }}>
                <div className={clsx(
                  'w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br',
                  opt.gradient,
                )}>
                  <Icon className="w-3.5 h-3.5 text-white" />
                </div>
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
