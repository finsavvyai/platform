/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ComparisonSection } from './ComparisonSection';

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
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

describe('ComparisonSection', () => {
  it('renders the section title', () => {
    render(<ComparisonSection />);
    expect(screen.getByText('Why TokenForge?')).toBeDefined();
  });

  it('renders all table headers', () => {
    render(<ComparisonSection />);
    expect(screen.getByText('Feature')).toBeDefined();
    expect(screen.getByText('TokenForge')).toBeDefined();
    expect(screen.getByText('Google DBSC')).toBeDefined();
    expect(screen.getByText('Session Cookies')).toBeDefined();
    expect(screen.getByText('Device Fingerprinting')).toBeDefined();
  });

  it('renders all feature rows', () => {
    render(<ComparisonSection />);
    expect(screen.getByText('Cross-browser')).toBeDefined();
    expect(screen.getByText('Framework agnostic')).toBeDefined();
    expect(screen.getByText('Cryptographic proof')).toBeDefined();
    expect(screen.getByText('Trust scoring')).toBeDefined();
    expect(screen.getByText('Step-up auth')).toBeDefined();
    expect(screen.getByText('Zero dependencies')).toBeDefined();
  });

  it('renders the subtitle text', () => {
    render(<ComparisonSection />);
    expect(
      screen.getByText(/cross-browser, framework-agnostic solution/),
    ).toBeDefined();
  });

  it('renders check icons for TokenForge features', () => {
    const { container } = render(<ComparisonSection />);
    const checkIcons = container.querySelectorAll('.text-ok');
    expect(checkIcons.length).toBeGreaterThan(0);
  });

  it('renders X icons for missing features', () => {
    const { container } = render(<ComparisonSection />);
    const xIcons = container.querySelectorAll('.text-alert');
    expect(xIcons.length).toBeGreaterThan(0);
  });
});
