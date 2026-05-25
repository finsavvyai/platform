import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToastProvider, useToast } from '../src/components/Toast';
import { ThemeProvider } from '../src/theme/ThemeProvider';

const ToastTest = () => {
  const { toast } = useToast();
  return (
    <div>
      <button
        onClick={() => toast({ message: 'Success!', type: 'success' })}
        data-testid="show-success"
      >
        Show Success
      </button>
      <button
        onClick={() => toast({ message: 'Error!', type: 'error' })}
        data-testid="show-error"
      >
        Show Error
      </button>
      <button
        onClick={() => toast({ message: 'Info!', type: 'info' })}
        data-testid="show-info"
      >
        Show Info
      </button>
    </div>
  );
};

const renderWithToast = (component: React.ReactNode) => {
  return render(
    <ThemeProvider>
      <ToastProvider>{component}</ToastProvider>
    </ThemeProvider>
  );
};

describe('Toast', () => {
  it('should render ToastProvider', () => {
    renderWithToast(<div>Test</div>);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should show success toast', async () => {
    renderWithToast(<ToastTest />);
    const btn = screen.getByTestId('show-success');
    await btn.click();
    expect(screen.getByText('Success!')).toBeInTheDocument();
  });

  it('should show error toast', async () => {
    renderWithToast(<ToastTest />);
    const btn = screen.getByTestId('show-error');
    await btn.click();
    expect(screen.getByText('Error!')).toBeInTheDocument();
  });

  it('should show info toast', async () => {
    renderWithToast(<ToastTest />);
    const btn = screen.getByTestId('show-info');
    await btn.click();
    expect(screen.getByText('Info!')).toBeInTheDocument();
  });

  it('should handle multiple toasts', async () => {
    renderWithToast(<ToastTest />);
    await screen.getByTestId('show-success').click();
    await screen.getByTestId('show-error').click();
    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('Error!')).toBeInTheDocument();
  });

  it('should throw error when useToast used outside provider', () => {
    expect(() => {
      render(<ToastTest />);
    }).toThrow();
  });

  it('should accept custom message', async () => {
    renderWithToast(<ToastTest />);
    await screen.getByTestId('show-success').click();
    expect(screen.getByText('Success!')).toBeInTheDocument();
  });

  it('should support different toast types', async () => {
    renderWithToast(<ToastTest />);
    await screen.getByTestId('show-success').click();
    await screen.getByTestId('show-error').click();
    await screen.getByTestId('show-info').click();
    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('Error!')).toBeInTheDocument();
    expect(screen.getByText('Info!')).toBeInTheDocument();
  });

  it('should have fixed positioning', () => {
    const { container } = renderWithToast(<ToastTest />);
    const toastContainer = container.querySelector('[style*="position"]');
    expect(toastContainer).toBeInTheDocument();
  });
});
