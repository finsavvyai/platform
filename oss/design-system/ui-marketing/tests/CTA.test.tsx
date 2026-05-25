import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CTA } from '../src/sections/CTA';

describe('CTA', () => {
  it('should render CTA section', () => {
    render(
      <CTA
        headline="Get Started"
        description="Join now"
        buttonText="Sign Up"
        onButtonClick={vi.fn()}
      />
    );
    expect(screen.getByTestId('cta')).toBeInTheDocument();
  });

  it('should display headline', () => {
    render(
      <CTA
        headline="Join Our Community"
        description="Join now"
        buttonText="Sign Up"
        onButtonClick={vi.fn()}
      />
    );
    expect(screen.getByTestId('cta-headline')).toHaveTextContent(
      'Join Our Community'
    );
  });

  it('should display description', () => {
    render(
      <CTA
        headline="Get Started"
        description="Sign up for exclusive access"
        buttonText="Sign Up"
        onButtonClick={vi.fn()}
      />
    );
    expect(screen.getByTestId('cta-description')).toHaveTextContent(
      'Sign up for exclusive access'
    );
  });

  it('should display button with correct text', () => {
    render(
      <CTA
        headline="Get Started"
        description="Join now"
        buttonText="Start Free Trial"
        onButtonClick={vi.fn()}
      />
    );
    expect(screen.getByTestId('cta-btn')).toHaveTextContent('Start Free Trial');
  });

  it('should call onButtonClick when button clicked', async () => {
    const onButtonClick = vi.fn();
    render(
      <CTA
        headline="Get Started"
        description="Join now"
        buttonText="Sign Up"
        onButtonClick={onButtonClick}
      />
    );
    await screen.getByTestId('cta-btn').click();
    expect(onButtonClick).toHaveBeenCalled();
  });

  it('should have blue background', () => {
    const { container } = render(
      <CTA
        headline="Get Started"
        description="Join now"
        buttonText="Sign Up"
        onButtonClick={vi.fn()}
      />
    );
    const cta = container.querySelector('[data-testid="cta"]');
    expect(cta).toHaveStyle({ backgroundColor: '#007AFF' });
  });

  it('should have white text', () => {
    const { container } = render(
      <CTA
        headline="Get Started"
        description="Join now"
        buttonText="Sign Up"
        onButtonClick={vi.fn()}
      />
    );
    const cta = container.querySelector('[data-testid="cta"]');
    expect(cta).toHaveStyle({ color: '#FFFFFF' });
  });
});
