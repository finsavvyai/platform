/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { HeroSection } from './HeroSection';

/* eslint-disable @typescript-eslint/no-unused-vars */
function createMotionComponent(tag: string) {
  return function MotionComponent({ children, ...props }: Record<string, unknown>) {
    const {
      initial, animate, whileInView, viewport, transition,
      whileHover, exit, variants, onAnimationComplete,
      ...rest
    } = props;
    return React.createElement(tag, rest, children as React.ReactNode);
  };
}

vi.mock('framer-motion', () => ({
  motion: new Proxy({} as Record<string, unknown>, {
    get: (_target, prop: string) => createMotionComponent(prop),
  }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe('HeroSection', () => {
  it('renders the main headline', () => {
    render(<HeroSection />);
    expect(screen.getByText(/Your auth stops at login/)).toBeDefined();
    expect(screen.getByText(/We protect everything after/)).toBeDefined();
  });

  it('renders the subtitle text', () => {
    render(<HeroSection />);
    expect(screen.getByText(/Device keys are auto-generated/)).toBeDefined();
  });

  it('renders the Get Started Free CTA', () => {
    render(<HeroSection />);
    const ctaLink = screen.getByText('Get Started Free');
    expect(ctaLink).toBeDefined();
    const anchor = ctaLink.closest('a');
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute('href')).toBe('/sign-up');
  });

  it('renders the Read the Docs link', () => {
    render(<HeroSection />);
    const docsLink = screen.getByText('Read the Docs');
    expect(docsLink).toBeDefined();
    const anchor = docsLink.closest('a');
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute('href')).toBe('/docs');
  });

  it('renders the badge text', () => {
    render(<HeroSection />);
    expect(screen.getByText(/Post-authentication session security/)).toBeDefined();
  });

  it('renders the free forever text', () => {
    render(<HeroSection />);
    expect(screen.getByText(/Free forever/)).toBeDefined();
  });
});
