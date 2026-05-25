'use client';

import { SiteHeader } from '@/components/SiteHeader';
import { HeroSection } from './HeroSection';
import { TrustBar, ProblemSection } from './HomeSections';
import { TokenForgeSection } from './HomeSections';
import { QuoteTicker } from './QuoteTicker';
import { SocialProofSection } from './SocialProofSection';
import { PillarsSection, DemoEmbedSection, HowItWorksSection } from './HomeFeatures';
import { DriftSection } from './HomeDriftSection';
import { EcosystemSection } from './EcosystemSection';
import { FinalCTASection, Footer } from './HomeFooter';

/**
 * Homepage layout following the competitor blueprint (competitors.md Part 4):
 * S1: Hero (short headline + product screenshot)
 * S2: Trust Bar
 * S3: Problem (before/after)
 * S4: Three Pillars
 * S5: Demo Embed
 * S6: How It Works
 * S7: Social Proof
 * S8: Final CTA
 */
export default function HomeClient() {
  return (
    <div className="min-h-screen bg-void">
      <SiteHeader />
      <main>
        <HeroSection />
        <TrustBar />
        <QuoteTicker />
        <ProblemSection />
        <PillarsSection />
        <DemoEmbedSection />
        <HowItWorksSection />
        <SocialProofSection />
        <DriftSection />
        <TokenForgeSection />
        <EcosystemSection />
        <FinalCTASection />

        {/* Hidden sections — all code preserved, uncomment to restore */}
        {/* <SolutionSection /> */}
        {/* <ComparisonSection /> */}
        {/* <StatsSection /> */}
        {/* <WhySection /> */}
      </main>
      <Footer />
    </div>
  );
}
