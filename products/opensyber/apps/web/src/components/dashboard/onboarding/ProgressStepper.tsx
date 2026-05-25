'use client';

import { Check } from 'lucide-react';

interface ProgressStepperProps {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}

export function ProgressStepper({
  currentStep,
  totalSteps,
  labels,
}: ProgressStepperProps) {
  return (
    <div className="flex items-center w-full mb-8">
      {Array.from({ length: totalSteps }, (_, i) => {
        const isCompleted = i < currentStep;
        const isActive = i === currentStep;

        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isActive
                      ? 'bg-info text-white'
                      : 'bg-neutral-800 text-neutral-500'
                }`}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className="text-xs text-neutral-400 mt-1.5 whitespace-nowrap">
                {labels[i]}
              </span>
            </div>
            {i < totalSteps - 1 && (
              <div className="h-0.5 flex-1 mx-2 bg-neutral-700 relative min-w-[2rem]">
                {isCompleted && (
                  <div className="absolute inset-0 bg-info rounded" />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
