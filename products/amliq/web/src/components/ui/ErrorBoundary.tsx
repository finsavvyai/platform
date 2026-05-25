import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './Button';
import { MaintenancePage } from './MaintenancePage';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function isNetworkError(error: Error | null): boolean {
  if (!error) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('loading css chunk') ||
    msg.includes('networkerror') ||
    msg.includes('failed to fetch')
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      if (isNetworkError(this.state.error)) {
        return <MaintenancePage onRetry={this.handleReset} />;
      }

      return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <h2 className="sf-title mb-md">Something went wrong</h2>
          <p className="sf-caption mb-lg">{this.state.error?.message}</p>
          <Button variant="primary" onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
