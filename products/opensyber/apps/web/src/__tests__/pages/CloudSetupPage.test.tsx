import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CloudSetupWizard from '@/app/dashboard/cloud/setup/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/app/dashboard/cloud/setup/ProviderSelect', () => ({
  ProviderSelect: () => <div data-testid="provider-select">Select a provider</div>,
}));
vi.mock('@/app/dashboard/cloud/setup/SetupInstructions', () => ({
  SetupInstructions: () => <div data-testid="setup-instructions" />,
}));
vi.mock('@/app/dashboard/cloud/setup/CredentialsForm', () => ({
  CredentialsForm: () => <div data-testid="credentials-form" />,
}));
vi.mock('@/app/dashboard/cloud/setup/ValidationStep', () => ({
  ValidationStep: () => <div data-testid="validation-step" />,
}));

describe('CloudSetupWizard', () => {
  it('renders heading', () => {
    render(<CloudSetupWizard />);
    expect(screen.getByText('Connect Cloud Account')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<CloudSetupWizard />);
    expect(
      screen.getByText(/Follow the guided setup/),
    ).toBeInTheDocument();
  });

  it('renders step indicators', () => {
    render(<CloudSetupWizard />);
    expect(screen.getByText('Select Provider')).toBeInTheDocument();
    expect(screen.getByText('Setup Instructions')).toBeInTheDocument();
    expect(screen.getByText('Enter Credentials')).toBeInTheDocument();
    expect(screen.getByText('Validate')).toBeInTheDocument();
  });

  it('shows provider select on initial step', () => {
    render(<CloudSetupWizard />);
    expect(screen.getByTestId('provider-select')).toBeInTheDocument();
  });

  it('renders back button', () => {
    render(<CloudSetupWizard />);
    expect(
      screen.getByText('Back to Cloud Security'),
    ).toBeInTheDocument();
  });
});
