import { useRef } from 'react';
import { btnGesturePrimary, btnGestureSubtle } from '../styles/gestures';
import { useFocusTrap } from '../hooks/useFocusTrap';
import StepDots, { TOTAL_STEPS } from './onboarding/StepDots';
import WelcomeStep from './onboarding/WelcomeStep';
import ConnectRepoStep from './onboarding/ConnectRepoStep';
import FirstRunStep from './onboarding/FirstRunStep';
import DoneStep from './onboarding/DoneStep';

interface Props {
  userName: string;
  step: number;
  setStep: (s: number) => void;
  onDismiss: () => void;
}

export default function OnboardingWizard({ userName, step, setStep, onDismiss }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const isFirst = step === 0;
  const isLast = step === TOTAL_STEPS - 1;

  useFocusTrap(dialogRef, { onEscape: onDismiss });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onDismiss}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="relative w-full max-w-md rounded-2xl border border-surface-border bg-surface-card shadow-2xl animate-slide-up overflow-hidden"
      >
        <h2 id="onboarding-title" className="sr-only">PushCI onboarding</h2>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Skip onboarding"
          className={`absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 text-xs font-medium px-2 py-1 rounded ${btnGestureSubtle}`}
        >
          Skip
        </button>

        <div className="px-6 pt-8 pb-4">
          <StepDots current={step} />
        </div>

        <div className="px-6 pb-6">
          {step === 0 && <WelcomeStep userName={userName} />}
          {step === 1 && <ConnectRepoStep />}
          {step === 2 && <FirstRunStep />}
          {step === 3 && <DoneStep />}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-surface-border bg-zinc-900/30">
          {isFirst ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className={`text-sm text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded ${btnGestureSubtle}`}
            >
              Back
            </button>
          )}

          {isLast ? (
            <button
              type="button"
              onClick={onDismiss}
              className={`px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-900 font-semibold text-sm ${btnGesturePrimary}`}
            >
              Get Started
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className={`px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-900 font-semibold text-sm ${btnGesturePrimary}`}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
