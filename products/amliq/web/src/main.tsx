import React from 'react'
import ReactDOM from 'react-dom/client'
import './i18n/config'
import App from './App'
import './index.css'
import { onLCP, onCLS, onINP } from 'web-vitals'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const TIME_BASED = new Set(['LCP', 'FID', 'INP', 'TTFB', 'FCP'])

function reportVital({ name, value, rating }: { name: string; value: number; rating: string }) {
  if (import.meta.env.DEV) {
    const label = TIME_BASED.has(name) ? `${Math.round(value)}ms` : value.toFixed(4)
    console.debug(`[vitals] ${name}: ${label} (${rating})`)
    return
  }
  if (import.meta.env.VITE_VITALS_ENABLED !== 'true') return
  fetch(`${API_BASE}/api/v1/analytics/vitals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, value, rating, url: new URL(location.href).pathname }),
    keepalive: true,
  }).catch(() => {})
}

onLCP(reportVital)
onCLS(reportVital)
onINP(reportVital)
