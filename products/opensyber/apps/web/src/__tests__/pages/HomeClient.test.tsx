import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomeClient from '@/app/HomeClient';

vi.mock('@/components/SiteHeader', () => ({
  SiteHeader: () => <header data-testid="site-header" />,
}));
vi.mock('@/app/HeroSection', () => ({
  HeroSection: () => <section data-testid="hero" />,
}));
vi.mock('@/app/HomeSections', () => ({
  TrustBar: () => <section data-testid="trust-bar" />,
  ProblemSection: () => <section data-testid="problem" />,
  SolutionSection: () => <section data-testid="solution" />,
  TokenForgeSection: () => <section data-testid="tokenforge" />,
}));
vi.mock('@/app/SocialProofSection', () => ({
  SocialProofSection: () => <section data-testid="social-proof" />,
}));
vi.mock('@/app/HomeFeatures', () => ({
  PillarsSection: () => <section data-testid="pillars" />,
  DemoEmbedSection: () => <section data-testid="demo-embed" />,
  HowItWorksSection: () => <section data-testid="how-it-works" />,
  ComparisonSection: () => null,
  StatsSection: () => null,
  WhySection: () => null,
}));
vi.mock('@/app/HomeDriftSection', () => ({
  DriftSection: () => <section data-testid="drift" />,
}));
vi.mock('@/app/EcosystemSection', () => ({
  EcosystemSection: () => <section data-testid="ecosystem" />,
}));
vi.mock('@/app/HomeFooter', () => ({
  FinalCTASection: () => <section data-testid="final-cta" />,
  Footer: () => <footer data-testid="footer" />,
}));

describe('HomeClient', () => {
  it('renders header and footer', () => {
    render(<HomeClient />);
    expect(screen.getByTestId('site-header')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('renders all visible sections in order', () => {
    render(<HomeClient />);
    expect(screen.getByTestId('hero')).toBeInTheDocument();
    expect(screen.getByTestId('trust-bar')).toBeInTheDocument();
    expect(screen.getByTestId('problem')).toBeInTheDocument();
    expect(screen.getByTestId('pillars')).toBeInTheDocument();
    expect(screen.getByTestId('demo-embed')).toBeInTheDocument();
    expect(screen.getByTestId('how-it-works')).toBeInTheDocument();
    expect(screen.getByTestId('social-proof')).toBeInTheDocument();
    expect(screen.getByTestId('drift')).toBeInTheDocument();
    expect(screen.getByTestId('tokenforge')).toBeInTheDocument();
    expect(screen.getByTestId('ecosystem')).toBeInTheDocument();
    expect(screen.getByTestId('final-cta')).toBeInTheDocument();
  });
});
