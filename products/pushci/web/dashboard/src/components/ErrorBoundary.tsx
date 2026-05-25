import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (state: State, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ info });
    if (typeof window !== 'undefined') {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  reset = (): void => {
    this.setState({ error: null, info: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.state, this.reset);
    return <DefaultFallback error={error} reset={this.reset} />;
  }
}

function DefaultFallback({ error, reset }: { error: Error; reset: () => void }) {
  const message = error.message || 'An unexpected error occurred.';
  return (
    <div
      role="alert"
      className="min-h-[60vh] flex items-center justify-center px-4 py-12"
    >
      <div className="max-w-lg w-full space-y-4">
        <h2 className="text-base font-semibold tracking-tight text-zinc-100">
          Something broke on this screen.
        </h2>
        <p className="text-sm text-zinc-400">
          The error has been logged to the console. You can try this screen
          again, or reload the dashboard.
        </p>
        <pre className="text-xs font-mono text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-3 whitespace-pre-wrap break-words max-h-40 overflow-auto">
          {message}
        </pre>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-surface-border px-4 py-2 text-sm text-zinc-300 hover:bg-surface-hover transition-colors"
          >
            Reload dashboard
          </button>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(`${message}\n${error.stack ?? ''}`);
            }}
            className="rounded-lg border border-surface-border px-4 py-2 text-sm text-zinc-400 hover:bg-surface-hover transition-colors"
          >
            Copy details
          </button>
        </div>
      </div>
    </div>
  );
}
