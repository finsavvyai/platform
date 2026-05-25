import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { Inter, Fira_Code, Source_Serif_4 } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { hasValidClerkKeys } from '../lib/clerk-env'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const firaCode = Fira_Code({
  subsets: ['latin'],
  variable: '--font-code',
  display: 'swap',
})

// Source Serif 4 — body face for sdlc.cc law-firm landing.
// Variables --font-heading / --font-body are consumed inside .law-theme
// in styles/globals.css. TODO(brand-kit): override once final brand
// kit lands at docs/brand/2026-05-16-brand-kit.md.
const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  display: 'swap',
})

export default function App({ Component, pageProps }: AppProps) {
  const content = (
    <div
      className={`${inter.variable} ${firaCode.variable} ${sourceSerif.variable} font-sans`}
      style={{
        // Make the heading/body CSS variables resolve to the loaded webfonts.
        ['--font-heading' as never]: 'var(--font-inter)',
        ['--font-body' as never]: 'var(--font-source-serif)',
      }}
    >
      <Component {...pageProps} />
    </div>
  )

  if (!hasValidClerkKeys()) {
    return content
  }

  return (
    <ClerkProvider>
      {content}
    </ClerkProvider>
  )
}
