import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const LANGUAGES = [
  { code: 'en', label: 'EN', native: 'English', flag: '🇺🇸' },
  { code: 'he', label: 'HE', native: 'עברית', flag: '🇮🇱' },
  { code: 'ar', label: 'AR', native: 'العربية', flag: '🇸🇦' },
] as const

export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = LANGUAGES.find(l => l.code === i18n.language) ?? LANGUAGES[0]

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <motion.button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors hover:bg-[var(--dash-surface-hover)] min-h-[36px]"
        style={{ color: 'var(--dash-text-secondary)' }}
        whileTap={{ scale: 0.92 }}
        aria-label="Switch language"
        aria-expanded={open}
      >
        <Globe className="w-3.5 h-3.5" />
        <span className="force-ltr">{current.label}</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute top-full mt-1 rounded-xl overflow-hidden z-50 min-w-[140px]"
            style={{
              background: 'var(--dash-surface)',
              border: '1px solid var(--dash-border)',
              boxShadow: 'var(--shadow-lg)',
              insetInlineEnd: 0,
            }}
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {LANGUAGES.map(({ code, native, flag }) => (
              <motion.button
                key={code}
                onClick={() => { i18n.changeLanguage(code); setOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer transition-colors hover:bg-[var(--dash-surface-hover)]"
                style={{
                  color: i18n.language === code ? 'var(--dash-text)' : 'var(--dash-text-secondary)',
                  fontFamily: code === 'ar' ? "'Cairo', sans-serif" : code === 'he' ? "'Rubik', sans-serif" : "'Inter', sans-serif",
                }}
                whileHover={{ x: 2 }}
                transition={{ duration: 0.12 }}
              >
                <span className="text-base leading-none">{flag}</span>
                <span className="flex-1 text-start">{native}</span>
                {i18n.language === code && (
                  <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--accent-gold)' }} />
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
