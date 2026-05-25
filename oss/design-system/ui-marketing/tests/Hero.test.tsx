import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Hero } from '../src/sections/Hero';

describe('Hero', () => {
  it('should render hero section', () => {
    render(
      <Hero
        headline="Welcome"
        subheadline="Get started"
        ctaText="Sign up"
        ctaHref="/"
      />
    );
    expect(screen.getByTestId('hero')).toBeInTheDocument();
  });

  it('should display headline', () => {
    render(
      <Hero
        headline="Welcome to FinSavvy"
        subheadline="Get started"
        ctaText="Sign up"
        ctaHref="/"
      />
    );
    expect(screen.getByTestId('headline')).toHaveTextContent('Welcome to FinSavvy');
  });

  it('should display subheadline', () => {
    render(
      <Hero
        headline="Welcome"
        subheadline="Get started with our platform"
        ctaText="Sign up"
        ctaHref="/"
      />
    );
    expect(screen.getByTestId('subheadline')).toHaveTextContent(
      'Get started with our platform'
    );
  });

  it('should display CTA button with correct text', () => {
    render(
      <Hero
        headline="Welcome"
        subheadline="Get started"
        ctaText="Sign up now"
        ctaHref="/signup"
      />
    );
    expect(screen.getByTestId('cta-button')).toHaveTextContent('Sign up now');
  });

  it('should link CTA button to correct href', () => {
    render(
      <Hero
        headline="Welcome"
        subheadline="Get started"
        ctaText="Sign up"
        ctaHref="/signup"
      />
    );
    expect(screen.getByTestId('cta-button')).toHaveAttribute('href', '/signup');
  });

  it('should apply custom background gradient', () => {
    const customGradient = 'linear-gradient(90deg, #FF0000, #0000FF)';
    const { container } = render(
      <Hero
        headline="Welcome"
        subheadline="Get started"
        ctaText="Sign up"
        ctaHref="/"
        backgroundGradient={customGradient}
      />
    );
    const hero = container.querySelector('[data-testid="hero"]');
    expect(hero).toHaveStyle({ background: customGradient });
  });
});
