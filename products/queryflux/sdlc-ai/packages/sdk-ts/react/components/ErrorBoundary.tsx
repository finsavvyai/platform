// Error Boundary Component for React

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
              <div className="flex items-center mb-4">
                <svg
                  className="w-12 h-12 text-red-500 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h2 className="text-xl font-semibold text-gray-900">
                  Something went wrong
                </h2>
              </div>
              <p className="text-gray-600 mb-4">
                An error occurred while rendering this component.
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
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
                className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
