import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OnboardingWizard, Step } from '../src/pages/OnboardingWizard';

const mockSteps: Step[] = [
  {
    id: 'step1',
    title: 'Welcome',
    description: 'Welcome to our platform',
    content: <div>Step 1 content</div>,
  },
  {
    id: 'step2',
    title: 'Setup',
    description: 'Setup your profile',
    content: <div>Step 2 content</div>,
  },
  {
    id: 'step3',
    title: 'Complete',
    description: 'You are ready!',
    content: <div>Step 3 content</div>,
  },
];

describe('OnboardingWizard', () => {
  it('should render wizard', () => {
    render(
      <OnboardingWizard steps={mockSteps} onComplete={vi.fn()} />
    );
    expect(screen.getByTestId('wizard')).toBeInTheDocument();
  });

  it('should display first step by default', () => {
    render(
      <OnboardingWizard steps={mockSteps} onComplete={vi.fn()} />
    );
    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByText('Step 1 content')).toBeInTheDocument();
  });

  it('should show progress bar', () => {
    render(
      <OnboardingWizard steps={mockSteps} onComplete={vi.fn()} />
    );
    expect(screen.getByTestId('progress')).toBeInTheDocument();
    expect(screen.getByTestId('progress-fill')).toBeInTheDocument();
  });

  it('should display current step number', () => {
    render(
      <OnboardingWizard steps={mockSteps} onComplete={vi.fn()} />
    );
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  });

  it('should navigate to next step', async () => {
    render(
      <OnboardingWizard steps={mockSteps} onComplete={vi.fn()} />
    );
    await screen.getByTestId('btn-next').click();
    expect(screen.getByText('Setup')).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
  });

  it('should navigate to previous step', async () => {
    const onComplete = vi.fn();
    const { rerender } = render(
      <OnboardingWizard steps={mockSteps} onComplete={onComplete} />
    );
    await screen.getByTestId('btn-next').click();
    rerender(<OnboardingWizard steps={mockSteps} onComplete={onComplete} />);
  });

  it('should disable previous button on first step', () => {
    render(
      <OnboardingWizard steps={mockSteps} onComplete={vi.fn()} />
    );
    expect(screen.getByTestId('btn-prev')).toBeDisabled();
  });

  it('should show Complete button on last step', async () => {
    render(
      <OnboardingWizard steps={mockSteps} onComplete={vi.fn()} />
    );
    await screen.getByTestId('btn-next').click();
    await screen.getByTestId('btn-next').click();
    const btn = screen.getByTestId('btn-next');
    expect(btn.textContent).toBe('Complete');
  });

  it('should call onComplete when completing wizard', async () => {
    const onComplete = vi.fn();
    render(
      <OnboardingWizard steps={mockSteps} onComplete={onComplete} />
    );
    await screen.getByTestId('btn-next').click();
    await screen.getByTestId('btn-next').click();
    await screen.getByTestId('btn-next').click();
  });
});
