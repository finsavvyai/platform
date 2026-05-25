// Error Boundary Component for React

import * as React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Something went wrong
              </h2>
              <p className="text-gray-600 mb-4">
                An error occurred while rendering this component.
              </p>
              {process.env.NODE_ENV === 'development' &&
                this.state.error && (
                  <details className="bg-gray-100 p-4 rounded">
                    <summary className="cursor-pointer font-mono text-sm">
                      Error details
                    </summary>
                    <pre className="mt-2 text-xs text-red-600 overflow-auto">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
              >
                Reload page
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
