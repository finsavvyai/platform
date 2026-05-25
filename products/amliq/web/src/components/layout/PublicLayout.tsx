import React from 'react'
import MarketingNav from '../../pages/marketing/MarketingNav'
import FooterSection from '../../pages/marketing/FooterSection'
import { PageTransition } from './PageTransition'
import { MarketingThemeProvider, useMarketingTheme } from '../../context/MarketingThemeContext'

interface PublicLayoutProps {
  children: React.ReactNode
}

function ThemedShell({ children }: PublicLayoutProps) {
  const { theme } = useMarketingTheme()
  return (
    <div
      data-theme={theme}
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <MarketingNav />
      <main className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <FooterSection />
    </div>
  )
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <MarketingThemeProvider>
      <ThemedShell>{children}</ThemedShell>
    </MarketingThemeProvider>
  )
}
