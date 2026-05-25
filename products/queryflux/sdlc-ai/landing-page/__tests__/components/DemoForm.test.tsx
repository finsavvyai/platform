import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DemoForm from '../../components/DemoForm';

// Mock fetch for API calls
global.fetch = vi.fn();

describe('DemoForm Component', () => {
  const mockFetch = global.fetch as any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders all form fields correctly', () => {
    render(<DemoForm />);

    // Check all required fields are present
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Work Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Company Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Implementation Timeline/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Describe Your Use Case/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Additional Information/i)).toBeInTheDocument();

    // Check submit button
    expect(screen.getByRole('button', { name: /Book Threat Review/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty required fields', async () => {
    const user = userEvent.setup();
    render(<DemoForm />);

    // Try to submit empty form
    const submitButton = screen.getByRole('button', { name: /Book Threat Review/i });
    await user.click(submitButton);

    // Check for validation errors
    await waitFor(() => {
      expect(screen.getByText(/Name must be at least 2 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/Please enter a valid email address/i)).toBeInTheDocument();
      expect(screen.getByText(/Company name must be at least 2 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/Select timeline/i)).toBeInTheDocument();
      expect(screen.getByText(/Please describe your use case/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for invalid email', async () => {
    const user = userEvent.setup();
    render(<DemoForm />);

    const emailInput = screen.getByLabelText(/Work Email/i);
    await user.type(emailInput, 'invalid-email');

    const submitButton = screen.getByRole('button', { name: /Book Threat Review/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Please enter a valid email address/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for short use case description', async () => {
    const user = userEvent.setup();
    render(<DemoForm />);

    const useCaseInput = screen.getByLabelText(/Describe Your Use Case/i);
    await user.type(useCaseInput, 'Too short');

    const submitButton = screen.getByRole('button', { name: /Book Threat Review/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Please describe your use case.*minimum 10 characters/i)).toBeInTheDocument();
    });
  });

  it('submits form successfully with valid data', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Demo request received successfully',
      }),
    });

    render(<DemoForm />);

    // Fill out form with valid data
    await user.type(screen.getByLabelText(/Full Name/i), 'John Doe');
    await user.type(screen.getByLabelText(/Work Email/i), 'john@company.com');
    await user.type(screen.getByLabelText(/Company Name/i), 'Acme Corporation');

    // Select timeline
    const timelineSelect = screen.getByLabelText(/Implementation Timeline/i);
    await user.selectOptions(timelineSelect, '1-month');

    await user.type(screen.getByLabelText(/Describe Your Use Case/i),
      'We need secure AI data processing for our financial services application with compliance requirements');
    await user.type(screen.getByLabelText(/Additional Information/i),
      'Looking forward to the demo');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /Book Threat Review/i });
    await user.click(submitButton);

    // Check loading state
    expect(screen.getByText(/Submitting.../)).toBeInTheDocument();

    // Wait for successful submission
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/demo-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'John Doe',
          email: 'john@company.com',
          company: 'Acme Corporation',
          useCase: 'We need secure AI data processing for our financial services application with compliance requirements',
          timeline: '1-month',
          message: 'Looking forward to the demo',
        }),
      });
    });

    // Check success message
    await waitFor(() => {
      expect(screen.getByText(/Threat Review Request Received/i)).toBeInTheDocument();
      expect(screen.getByText(/Thanks for reaching out to OpenSyber/i)).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    const user = userEvent.setup();
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<DemoForm />);

    // Fill out minimal valid form
    await user.type(screen.getByLabelText(/Full Name/i), 'John Doe');
    await user.type(screen.getByLabelText(/Work Email/i), 'john@company.com');
    await user.type(screen.getByLabelText(/Company Name/i), 'Acme Corp');
    await user.selectOptions(screen.getByLabelText(/Implementation Timeline/i), 'immediate');
    await user.type(screen.getByLabelText(/Describe Your Use Case/i),
      'Valid use case description that meets minimum requirements');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /Book Threat Review/i });
    await user.click(submitButton);

    // Wait for error handling (form should not show success message)
    await waitFor(() => {
      expect(screen.queryByText(/Demo Request Received!/i)).not.toBeInTheDocument();
      // Form should still be visible for retry
      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    });
  });

  it('shows success state with next steps', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Demo request received successfully',
      }),
    });

    render(<DemoForm />);

    // Fill and submit form
    await user.type(screen.getByLabelText(/Full Name/i), 'Jane Smith');
    await user.type(screen.getByLabelText(/Work Email/i), 'jane@company.com');
    await user.type(screen.getByLabelText(/Company Name/i), 'Tech Corp');
    await user.selectOptions(screen.getByLabelText(/Implementation Timeline/i), '3-months');
    await user.type(screen.getByLabelText(/Describe Your Use Case/i),
      'We need secure AI processing for healthcare data with HIPAA compliance');

    const submitButton = screen.getByRole('button', { name: /Book Threat Review/i });
    await user.click(submitButton);

    // Check success state content
    await waitFor(() => {
      expect(screen.getByText(/What happens next:/i)).toBeInTheDocument();
      expect(screen.getByText(/Security and compliance discovery call/i)).toBeInTheDocument();
      expect(screen.getByText(/Mapping of your AI data paths and high-risk prompts/i)).toBeInTheDocument();
      expect(screen.getByText(/Live policy simulation in your target environment/i)).toBeInTheDocument();
      expect(screen.getByText(/Launch plan with pilot milestones and ownership/i)).toBeInTheDocument();
    });
  });

  it('has proper accessibility attributes', () => {
    render(<DemoForm />);

    // Check form labels are properly associated
    const nameInput = screen.getByLabelText(/Full Name/i);
    expect(nameInput).toHaveAttribute('type', 'text');
    expect(nameInput).toHaveAttribute('required');

    const emailInput = screen.getByLabelText(/Work Email/i);
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('required');

    // Check required fields
    expect(screen.getByLabelText(/Company Name/i)).toHaveAttribute('required');
    expect(screen.getByLabelText(/Describe Your Use Case/i)).toHaveAttribute('required');

    // Check button accessibility
    const submitButton = screen.getByRole('button', { name: /Book Threat Review/i });
    expect(submitButton).toHaveAttribute('type', 'submit');
  });
});
