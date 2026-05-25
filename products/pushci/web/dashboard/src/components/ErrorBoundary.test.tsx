import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

function Boom({ message = 'kaboom' }: { message?: string }): JSX.Element {
  throw new Error(message);
}

const consoleErrorSpy = vi.spyOn(console, 'error');

beforeEach(() => {
  consoleErrorSpy.mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockClear();
});

describe('ErrorBoundary', () => {
  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <p>healthy</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('healthy')).toBeInTheDocument();
  });

  it('renders default fallback with role=alert on render error', () => {
    render(
      <ErrorBoundary>
        <Boom message="explode" />
      </ErrorBoundary>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/something broke/i);
    expect(alert).toHaveTextContent('explode');
  });

  it('offers retry, reload, and copy actions', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy details/i })).toBeInTheDocument();
  });

  it('resets and renders children again when Try again is clicked', () => {
    let shouldThrow = true;
    function Toggle() {
      if (shouldThrow) throw new Error('first render');
      return <p>recovered</p>;
    }
    render(
      <ErrorBoundary>
        <Toggle />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByText('recovered')).toBeInTheDocument();
  });

  it('uses a custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={(state) => <p>fallback: {state.error?.message}</p>}>
        <Boom message="custom" />
      </ErrorBoundary>,
    );
    expect(screen.getByText('fallback: custom')).toBeInTheDocument();
  });
});
