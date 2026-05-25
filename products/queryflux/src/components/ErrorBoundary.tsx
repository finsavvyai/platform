/**
 * Error Boundary Component
 *
 * Catches JavaScript errors in component tree and displays fallback UI
 */

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: { componentStack: string }) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to error reporting service (e.g., Sentry)
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <div className="mb-4 text-6xl">⚠️</div>
            <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
              Something went wrong
            </h2>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={this.handleReset}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Query Error Boundary
 *
 * Specialized error boundary for React Query errors
 */
import { useQueryErrorResetBoundary } from '@tanstack/react-query';

export function QueryErrorBoundary({ children }: { children: ReactNode }) {
  const { reset } = useQueryErrorResetBoundary();

  return (
    <ErrorBoundary
      onError={() => {
        // Reset React Query error state on error
        reset();
      }}
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <div className="mb-4 text-6xl">🔴</div>
            <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
              Failed to Load Data
            </h2>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              There was a problem loading the data. Please try again.
            </p>
            <button
              onClick={reset}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
