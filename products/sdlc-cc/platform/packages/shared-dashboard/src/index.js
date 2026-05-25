/**
 * Dashboard Entry Point
 * Main entry point for the unified dashboard application
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';
// Make sure DOM is loaded before rendering
const container = document.getElementById('root');
if (!container) {
    throw new Error('Root container not found');
}
const root = createRoot(container);
root.render(<React.StrictMode>
    <App />
  </React.StrictMode>);
// Enable hot module replacement in development
if (import.meta.hot) {
    import.meta.hot.accept();
}
//# sourceMappingURL=index.js.map