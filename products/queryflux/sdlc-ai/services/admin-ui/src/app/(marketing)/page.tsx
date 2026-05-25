import { Navbar } from '@/components/landing/navbar'
import { Hero } from '@/components/landing/hero'
import { TrustBar } from '@/components/landing/trust-bar'
import { Features } from '@/components/landing/features'
import { HowItWorks } from '@/components/landing/how-it-works'
import { Pricing } from '@/components/landing/pricing'
import { CtaSection } from '@/components/landing/cta-section'
import { Footer } from '@/components/landing/footer'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-slate-950">
      <Navbar />
      <Hero />
      <TrustBar />
      <Features />
      <HowItWorks />
      <Pricing />
      <CtaSection />
      <Footer />
    </main>
  )
}
