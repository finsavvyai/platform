import React from 'react'
import { motion } from 'framer-motion'
import Logo from '../brand/Logo'

interface Props {
  children: React.ReactNode
  showLogo?: boolean
}

export function AuthShell({ children, showLogo = true }: Props) {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10 overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #0A0908 0%, #110F0C 50%, #0D0B09 100%)' }}>
      <motion.div
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 700, height: 700, top: '-22%', right: '-18%',
          background: 'radial-gradient(circle, rgba(201,169,110,0.10) 0%, transparent 60%)',
        }}
        animate={{ scale: [1, 1.07, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 460, height: 460, bottom: '-12%', left: '-10%',
          background: 'radial-gradient(circle, rgba(45,122,79,0.08) 0%, transparent 65%)',
        }}
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.022] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(201,169,110,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(201,169,110,0.5) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
      <div className="relative z-10 w-full max-w-sm">
        {showLogo && (
          <div className="mb-8 flex justify-center" style={{ ['--text' as string]: '#F0EDE7' } as React.CSSProperties}>
            <Logo size={32} variant="light" />
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

export const authInputStyle: React.CSSProperties = {
  background: 'rgba(250,250,248,0.04)',
  border: '1px solid rgba(250,250,248,0.10)',
  color: '#FAFAF8',
  borderRadius: 10,
  width: '100%',
  padding: '12px 16px',
  fontSize: 14,
  minHeight: 48,
  outline: 'none',
  transition: 'all 0.2s ease',
}

export function authInputFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#C9A96E'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.18)'
}

export function authInputBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'rgba(250,250,248,0.10)'
  e.currentTarget.style.boxShadow = 'none'
}

export const authPrimaryStyle: React.CSSProperties = {
  background: '#C9A96E',
  color: '#0A0908',
  borderRadius: 10,
  width: '100%',
  padding: '12px 20px',
  fontSize: 14,
  fontWeight: 600,
  minHeight: 48,
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
}
