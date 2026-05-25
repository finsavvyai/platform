'use client';

import { useState } from 'react';
import { ProgressStepper } from './ProgressStepper';
import { StepDeploy } from './WizardSteps';
import { StepAutoSetup } from './StepAutoSetup';
import { StepConnect } from './StepConnect';
import { StepConnectSmart } from './StepConnectSmart';
import { StepCelebration } from './StepCelebration';

const STEP_LABELS = [
  'Deploy Agent',
  'Connect Machine',
  'Done',
];

// Feature flag — set NEXT_PUBLIC_AUTO_ONBOARDING=true to surface the adaptive flow.
// Defaults off so production traffic keeps the existing wizard until we're ready.
const AUTO_ONBOARDING_ENABLED = process.env.NEXT_PUBLIC_AUTO_ONBOARDING === 'true';

export function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  // When auto mode is on, the user can still escape into the manual flow.
  // We track that separately so the persona detection doesn't flicker back.
  const [customizing, setCustomizing] = useState(false);
  const showAutoSetup = AUTO_ONBOARDING_ENABLED && !customizing;

  function handleNext() {
    setCurrentStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  }

  // Mark onboarding complete server-side before reloading. Without this,
  // DashboardPage re-renders the wizard on every visit because
  // `onboarding_completed_at` stays null — users got trapped in a loop.
  async function handleFinish() {
    try {
      await fetch('/api/proxy/user/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismiss: true }),
      });
    } catch {
      // Best-effort — if the dismiss fails we still reload so the user
      // at least sees the real dashboard. The checklist will catch
      // the unset flag on the next visit.
    }
    window.location.reload();
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <ProgressStepper
        currentStep={currentStep}
        totalSteps={STEP_LABELS.length}
        labels={STEP_LABELS}
      />

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8">
        {currentStep === 0 && showAutoSetup && (
          <StepAutoSetup
            onNext={handleNext}
            onCustomize={() => setCustomizing(true)}
          />
        )}
        {currentStep === 0 && !showAutoSetup && <StepDeploy onNext={handleNext} />}
        {currentStep === 1 && showAutoSetup && <StepConnectSmart onNext={handleNext} />}
        {currentStep === 1 && !showAutoSetup && <StepConnect onNext={handleNext} />}
        {currentStep === 2 && <StepCelebration onFinish={handleFinish} />}
      </div>
    </div>
  );
}
