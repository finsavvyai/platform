import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
    expect(screen.getByRole('button', { name: /Schedule demo/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty required fields', async () => {
    const { container } = render(<DemoForm />);

    const form = container.querySelector('form');
    expect(form).toBeTruthy();
    await act(async () => {
      fireEvent.submit(form!);
    });

    expect(screen.getAllByText(/Name must be at least 2 characters/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Company name must be at least 2 characters/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Please describe your use case/i).length).toBeGreaterThanOrEqual(1);
  });

  it('shows validation error for invalid email', async () => {
    const user = userEvent.setup();
    const { container } = render(<DemoForm />);

    const emailInput = screen.getByLabelText(/Work Email/i);
    await user.type(emailInput, 'invalid-email');

    const form = container.querySelector('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText(/valid email address|Please enter a valid/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows validation error for short use case description', async () => {
    const user = userEvent.setup();
    const { container } = render(<DemoForm />);

    const useCaseInput = screen.getByLabelText(/Describe Your Use Case/i);
    await user.type(useCaseInput, 'Too short');

    const form = container.querySelector('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText(/describe your use case|minimum 10/i)).toBeInTheDocument();
    }, { timeout: 3000 });
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
    const submitButton = screen.getByRole('button', { name: /Schedule demo/i });
    await user.click(submitButton);

    // Wait for successful submission
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/demo-request', expect.any(Object));
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/demo-request',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    // Check success message (component shows "Demo request received")
    await waitFor(() => {
      expect(screen.getByText(/Demo request received/i)).toBeInTheDocument();
      expect(screen.getByText(/Our team will contact you within 24 hours/i)).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        message: 'Demo request delivery is not configured for this environment',
      }),
    });

    render(<DemoForm />);

    // Fill out minimal valid form
    await user.type(screen.getByLabelText(/Full Name/i), 'John Doe');
    await user.type(screen.getByLabelText(/Work Email/i), 'john@company.com');
    await user.type(screen.getByLabelText(/Company Name/i), 'Acme Corp');
    await user.selectOptions(screen.getByLabelText(/Implementation Timeline/i), 'immediate');
    await user.type(screen.getByLabelText(/Describe Your Use Case/i),
      'Valid use case description that meets minimum requirements');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /Schedule demo/i });
    await user.click(submitButton);

    // Wait for error handling (form should not show success message)
    await waitFor(() => {
      expect(screen.queryByText(/Demo request received/i)).not.toBeInTheDocument();
      // Form should still be visible for retry
      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Demo request delivery is not configured for this environment/i)
      ).toBeInTheDocument();
    });
  });

  it('shows success state after submit', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Demo request received successfully',
      }),
    });

    render(<DemoForm />);

    await user.type(screen.getByLabelText(/Full Name/i), 'Jane Smith');
    await user.type(screen.getByLabelText(/Work Email/i), 'jane@company.com');
    await user.type(screen.getByLabelText(/Company Name/i), 'Tech Corp');
    await user.selectOptions(screen.getByLabelText(/Implementation Timeline/i), '3-months');
    await user.type(screen.getByLabelText(/Describe Your Use Case/i),
      'We need secure AI processing for healthcare data with HIPAA compliance');

    const submitButton = screen.getByRole('button', { name: /Schedule demo/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Demo request received/i)).toBeInTheDocument();
      expect(screen.getByText(/Our team will contact you within 24 hours/i)).toBeInTheDocument();
    });
  });

  it('has proper accessibility attributes', () => {
    render(<DemoForm />);

    const nameInput = screen.getByLabelText(/Full Name/i);
    expect(nameInput).toHaveAttribute('type', 'text');

    const emailInput = screen.getByLabelText(/Work Email/i);
    expect(emailInput).toHaveAttribute('type', 'email');

    expect(screen.getByLabelText(/Company Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Describe Your Use Case/i)).toBeInTheDocument();

    const submitButton = screen.getByRole('button', { name: /Schedule demo/i });
    expect(submitButton).toHaveAttribute('type', 'submit');
  });
});
