import React from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { CheckCircle } from 'lucide-react'
import Logo from '../brand/Logo'

export function SignupLeftPanel() {
  const { t } = useTranslation('auth')
  const perks = [
    t('signup_panel.perk_ai'),
    t('signup_panel.perk_lists', { listCount: 7 }),
    t('signup_panel.perk_compliance'),
    t('signup_panel.perk_speed'),
  ]
  return (
    <div
      className="hidden lg:flex lg:w-1/2 relative flex-col justify-center px-16 overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #0A0908 0%, #110F0C 50%, #0D0B09 100%)' }}
    >
      <motion.div
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 620, height: 620, top: '-18%', right: '-22%',
          background: 'radial-gradient(circle, rgba(201,169,110,0.13) 0%, transparent 60%)',
        }}
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(201,169,110,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(201,169,110,0.5) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
      <div className="relative z-10 max-w-md">
        <div className="mb-10" style={{ ['--text' as string]: '#F0EDE7' } as React.CSSProperties}>
          <Logo size={32} variant="light" />
        </div>
        <h1
          className="text-[2.4rem] font-bold leading-[1.06] mb-5"
          style={{ color: '#FAFAF8', letterSpacing: '-0.03em' }}
        >
          {t('signup_panel.tagline').split(' ').slice(0, -2).join(' ')}{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #C9A96E 0%, #E8D5A3 50%, #B8945A 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {t('signup_panel.tagline').split(' ').slice(-2).join(' ')}
          </span>
        </h1>
        <p className="mb-10 max-w-md leading-relaxed text-[15px]" style={{ color: 'rgba(250,250,248,0.62)' }}>
          {t('signup_panel.description')}
        </p>
        <div className="space-y-3.5">
          {perks.map((text) => (
            <div key={text} className="flex items-center gap-3">
              <div
                className="flex items-center justify-center w-8 h-8 rounded-[10px]"
                style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.18)' }}
              >
                <CheckCircle className="h-4 w-4" style={{ color: '#C9A96E' }} />
              </div>
              <span className="text-sm" style={{ color: 'rgba(250,250,248,0.85)' }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
