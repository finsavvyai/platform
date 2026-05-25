'use client';

import Link from 'next/link';
import { Shield } from 'lucide-react';
import { HeroSection } from '@/components/landing/HeroSection';
import { AttackComparison } from '@/components/landing/AttackComparison';
import { ProblemSection } from '@/components/landing/ProblemSection';
import { HowItWorksSection } from '@/components/landing/HowItWorksSection';
import { TrustScoreSection } from '@/components/landing/TrustScoreSection';
import { CodeExampleSection } from '@/components/landing/CodeExampleSection';
import { FrameworksSection } from '@/components/landing/FrameworksSection';
import { ComparisonSection } from '@/components/landing/ComparisonSection';
import { PricingSection } from '@/components/landing/PricingSection';
import { EcosystemSection } from '@/components/landing/EcosystemSection';
import { FaqSection } from '@/components/landing/FaqSection';
import { FooterSection } from '@/components/landing/FooterSection';

export function LandingClient(): React.ReactElement {
  return (
    <div className="min-h-screen bg-void">
      <nav aria-label="Main navigation" className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-void/80 backdrop-blur-lg">
        <div className="mx-auto max-w-7xl px-6 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
            <Shield className="h-4 w-4 text-info" />
            TokenForge
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <a
              href="https://opensyber.cloud"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-border text-text-secondary no-underline transition-all duration-200 whitespace-nowrap hover:text-info hover:border-info/30"
            >
              Part of OpenSyber
            </a>
            <Link
              href="/sign-in"
              className="text-sm font-medium text-text-secondary hover:text-text-primary transition"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>
      <main>
        <HeroSection />
        <AttackComparison />
        <ProblemSection />
        <HowItWorksSection />
        <TrustScoreSection />
        <CodeExampleSection />
        <FrameworksSection />
        <ComparisonSection />
        <PricingSection />
        <EcosystemSection />
        <FaqSection />
        <FooterSection />
      </main>
    </div>
  );
}
