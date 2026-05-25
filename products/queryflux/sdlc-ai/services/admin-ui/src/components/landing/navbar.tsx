'use client'

import { useState } from 'react'
import { Shield, Menu, X } from 'lucide-react'

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Docs', href: '#docs' },
  { label: 'Blog', href: '#blog' },
]

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav
      className="fixed top-4 left-4 right-4 z-50 backdrop-blur-xl bg-white/80
        dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800
        rounded-2xl shadow-sm"
    >
      <div className="flex items-center justify-between px-6 py-3 max-w-7xl mx-auto">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 cursor-pointer">
          <Shield className="h-7 w-7 text-[#1E40AF]" strokeWidth={2.2} />
          <span className="text-xl font-bold tracking-tight text-[#1E293B] dark:text-white">
            SDLC.ai
          </span>
        </a>

        {/* Desktop links */}
        <ul className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                className="text-sm font-medium text-slate-600 dark:text-slate-300
                  hover:text-[#1E293B] dark:hover:text-white
                  transition-colors duration-200 cursor-pointer"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="/login"
            className="min-h-[44px] px-5 flex items-center text-sm font-medium
              text-slate-600 dark:text-slate-300 hover:text-[#1E293B]
              dark:hover:text-white transition-colors duration-200 cursor-pointer"
          >
            Log In
          </a>
          <a
            href="/signup"
            className="min-h-[44px] px-5 flex items-center rounded-lg text-sm
              font-semibold bg-[#F59E0B] text-[#1E293B] hover:bg-amber-400
              transition-colors duration-200 cursor-pointer"
          >
            Start Free Trial
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden min-h-[44px] min-w-[44px] flex items-center
            justify-center cursor-pointer text-slate-600 dark:text-slate-300"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 px-6 pb-4 pt-2">
          <ul className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="block min-h-[44px] py-2 text-sm font-medium
                    text-slate-600 dark:text-slate-300 hover:text-[#1E293B]
                    dark:hover:text-white transition-colors duration-200 cursor-pointer"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 mt-3">
            <a
              href="/login"
              className="min-h-[44px] flex items-center justify-center rounded-lg
                text-sm font-medium text-slate-600 dark:text-slate-300 border
                border-slate-200 dark:border-slate-700 hover:text-[#1E293B]
                dark:hover:text-white transition-colors duration-200 cursor-pointer"
            >
              Log In
            </a>
            <a
              href="/signup"
              className="min-h-[44px] flex items-center justify-center rounded-lg
                text-sm font-semibold bg-[#F59E0B] text-[#1E293B] hover:bg-amber-400
                transition-colors duration-200 cursor-pointer"
            >
              Start Free Trial
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}
