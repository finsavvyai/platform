import React, { useState } from 'react';

export interface Step {
  id: string;
  title: string;
  description: string;
  content: React.ReactNode;
}

interface OnboardingWizardProps {
  steps: Step[];
  onComplete: (stepId: string) => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  steps,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  const containerStyle: React.CSSProperties = {
    padding: '40px',
    maxWidth: '600px',
    margin: '0 auto',
    fontFamily: 'SF Pro Display, -apple-system, sans-serif',
  };

  const progressStyle: React.CSSProperties = {
    marginBottom: '32px',
  };

  const progressBarStyle: React.CSSProperties = {
    height: '4px',
    backgroundColor: '#E5E5EA',
    borderRadius: '2px',
    overflow: 'hidden',
    marginBottom: '12px',
  };

  const progressFillStyle: React.CSSProperties = {
    height: '100%',
    backgroundColor: '#007AFF',
    width: `${((currentStep + 1) / steps.length) * 100}%`,
    transition: 'width 0.3s ease',
  };

  const stepContentStyle: React.CSSProperties = {
    padding: '24px',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    border: '1px solid #E5E5EA',
    marginBottom: '24px',
  };

  const buttonGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    justifyContent: 'space-between',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s',
  };

  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#F2F2F7',
    color: '#000000',
  };

  const step = steps[currentStep];

  return (
    <div style={containerStyle} data-testid="wizard">
      <div style={progressStyle} data-testid="progress">
        <div style={progressBarStyle}>
          <div style={progressFillStyle} data-testid="progress-fill" />
        </div>
        <p style={{ fontSize: '12px', color: '#8E8E93', margin: 0 }}>
          Step {currentStep + 1} of {steps.length}
        </p>
      </div>

      <div style={stepContentStyle} data-testid={`step-${step.id}`}>
        <h2 style={{ fontSize: '24px', marginTop: 0, marginBottom: '8px' }}>
          {step.title}
        </h2>
        <p style={{ color: '#8E8E93', marginBottom: '16px' }}>
          {step.description}
        </p>
        <div>{step.content}</div>
      </div>

      <div style={buttonGroupStyle} data-testid="wizard-buttons">
        <button
          style={secondaryButtonStyle}
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          data-testid="btn-prev"
        >
          Previous
        </button>
        <button
          style={primaryButtonStyle}
          onClick={() => {
            if (currentStep < steps.length - 1) {
              setCurrentStep(currentStep + 1);
            } else {
              onComplete(step.id);
            }
          }}
          data-testid="btn-next"
        >
          {currentStep === steps.length - 1 ? 'Complete' : 'Next'}
        </button>
      </div>
    </div>
  );
};

OnboardingWizard.displayName = 'OnboardingWizard';
