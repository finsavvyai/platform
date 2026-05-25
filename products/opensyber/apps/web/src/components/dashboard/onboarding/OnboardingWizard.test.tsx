import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OnboardingWizard } from './OnboardingWizard';

vi.mock('framer-motion', () => ({
  motion: { div: 'div' },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

describe('OnboardingWizard', () => {
  it('renders the 3-step labels in the stepper', () => {
    render(<OnboardingWizard />);
    // "Deploy Agent" appears twice: once in the stepper, once on the CTA button
    expect(screen.getAllByText('Deploy Agent').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Connect Machine')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
  });

  it('renders the first step (Deploy)', () => {
    render(<OnboardingWizard />);
    expect(screen.getByText('Deploy Your First Agent')).toBeTruthy();
  });

  it('shows the deploy form inputs', () => {
    render(<OnboardingWizard />);
    expect(screen.getByDisplayValue('My Agent')).toBeTruthy();
    expect(screen.getAllByText('Deploy Agent').length).toBeGreaterThanOrEqual(1);
  });

  it('shows skip link on first step', () => {
    render(<OnboardingWizard />);
    expect(screen.getByText('Skip this step')).toBeTruthy();
  });
});
