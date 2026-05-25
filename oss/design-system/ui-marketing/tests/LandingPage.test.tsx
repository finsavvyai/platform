import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LandingPage, LandingPageConfig } from '../src/pages/LandingPage';

const mockConfig: LandingPageConfig = {
  hero: {
    headline: 'Welcome',
    subheadline: 'Get started',
    ctaText: 'Sign Up',
    ctaHref: '/signup',
  },
  features: [
    {
      icon: '⚡',
      title: 'Fast',
      description: 'Quick performance',
    },
  ],
  testimonials: [
    {
      quote: 'Great product',
      author: 'John Doe',
      company: 'TechCorp',
    },
  ],
  cta: {
    headline: 'Ready to start?',
    description: 'Join today',
    buttonText: 'Get Started',
    onButtonClick: vi.fn(),
  },
  footer: {
    links: [
      { label: 'Privacy', href: '/privacy' },
    ],
    copyright: '2024 FinSavvy',
  },
};

describe('LandingPage', () => {
  it('should render landing page', () => {
    render(<LandingPage config={mockConfig} />);
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
  });

  it('should render hero section', () => {
    render(<LandingPage config={mockConfig} />);
    expect(screen.getByTestId('hero')).toBeInTheDocument();
  });

  it('should render features section', () => {
    render(<LandingPage config={mockConfig} />);
    expect(screen.getByTestId('features')).toBeInTheDocument();
  });

  it('should render testimonials section', () => {
    render(<LandingPage config={mockConfig} />);
    expect(screen.getByTestId('testimonials')).toBeInTheDocument();
  });

  it('should render CTA section', () => {
    render(<LandingPage config={mockConfig} />);
    expect(screen.getByTestId('cta')).toBeInTheDocument();
  });

  it('should render footer section', () => {
    render(<LandingPage config={mockConfig} />);
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('should display hero headline', () => {
    render(<LandingPage config={mockConfig} />);
    expect(screen.getByText('Welcome')).toBeInTheDocument();
  });

  it('should display feature title', () => {
    render(<LandingPage config={mockConfig} />);
    expect(screen.getByText('Fast')).toBeInTheDocument();
  });

  it('should display testimonial quote', () => {
    render(<LandingPage config={mockConfig} />);
    expect(screen.getByText(/Great product/)).toBeInTheDocument();
  });

  it('should display footer links', () => {
    render(<LandingPage config={mockConfig} />);
    expect(screen.getByText('Privacy')).toBeInTheDocument();
  });
});
