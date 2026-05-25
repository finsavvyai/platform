'use client';

import { PricingSection } from '@/components/landing/PricingSection';
import { FooterSection } from '@/components/landing/FooterSection';

export function PricingClient(): React.ReactElement {
  return (
    <div className="min-h-screen bg-void pt-36">
      <PricingSection />
      <FooterSection />
    </div>
  );
}
