import { StrictMode, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/themes.css'
import App from './App.tsx'
import { loadTheme } from './styles/themes'

// Initialize theme before rendering
loadTheme()

import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null; errorInfo: ErrorInfo | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center p-4 font-sans">
          <div className="max-w-xl w-full bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-8 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-3">Something went wrong</h1>
              <p className="text-gray-400 mb-8 max-w-md">
                We apologize, but an unexpected error has occurred in the application. Our team has been notified.
              </p>

              <button
                onClick={() => window.location.reload()}
                className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors mb-6"
              >
                <RefreshCw className="w-5 h-5" />
                Reload Page
              </button>

              {process.env.NODE_ENV === 'development' && (
                <div className="w-full text-left mt-4">
                  <details className="group border border-white/5 rounded-lg bg-black/20 overflow-hidden">
                    <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-400 hover:text-gray-300 select-none flex items-center justify-between">
                      View Error Details
                      <span className="transition group-open:rotate-180">↓</span>
                    </summary>
                    <div className="px-4 pb-4 pt-1">
                      <pre className="text-xs text-red-400 font-mono overflow-auto max-h-48 p-3 bg-black/40 rounded border border-red-500/20">
                        {this.state.error?.toString()}
                        <br />
                        {this.state.errorInfo?.componentStack}
                      </pre>
                    </div>
                  </details>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
