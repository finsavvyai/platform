import React from 'react';
import { Hero } from '../sections/Hero';
import { Features, Feature } from '../sections/Features';
import { Testimonials, Testimonial } from '../sections/Testimonials';
import { CTA } from '../sections/CTA';
import { Footer, FooterLink } from '../sections/Footer';

export interface LandingPageConfig {
  hero: {
    headline: string;
    subheadline: string;
    ctaText: string;
    ctaHref: string;
  };
  features: Feature[];
  testimonials: Testimonial[];
  cta: {
    headline: string;
    description: string;
    buttonText: string;
    onButtonClick: () => void;
  };
  footer: {
    links: FooterLink[];
    copyright: string;
  };
}

interface LandingPageProps {
  config: LandingPageConfig;
}

export const LandingPage: React.FC<LandingPageProps> = ({ config }) => {
  return (
    <div data-testid="landing-page">
      <Hero
        headline={config.hero.headline}
        subheadline={config.hero.subheadline}
        ctaText={config.hero.ctaText}
        ctaHref={config.hero.ctaHref}
      />
      <Features features={config.features} />
      <Testimonials testimonials={config.testimonials} />
      <CTA
        headline={config.cta.headline}
        description={config.cta.description}
        buttonText={config.cta.buttonText}
        onButtonClick={config.cta.onButtonClick}
      />
      <Footer links={config.footer.links} copyright={config.footer.copyright} />
    </div>
  );
};

LandingPage.displayName = 'LandingPage';
