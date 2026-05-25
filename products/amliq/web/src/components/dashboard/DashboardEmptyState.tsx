import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Upload, Key } from 'lucide-react'

const steps = [
  {
    icon: Search, title: 'Screen your first entity',
    desc: 'Run a sanctions screening to see results populate your dashboard.',
    path: '/screen', cta: 'Screen Entity',
  },
  {
    icon: Upload, title: 'Upload a batch file',
    desc: 'Screen a customer list in bulk using CSV upload.',
    path: '/batch', cta: 'Batch Upload',
  },
  {
    icon: Key, title: 'Set up API access',
    desc: 'Generate API keys to integrate screening into your workflows.',
    path: '/keys', cta: 'API Keys',
  },
]

export function DashboardEmptyState() {
  const navigate = useNavigate()

  return (
    <div className="card-vibrancy p-8 text-center">
      <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--dash-text)' }}>
        Welcome to AMLIQ
      </h2>
      <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: 'var(--dash-text-secondary)' }}>
        Your screening dashboard will show alerts, metrics, and activity once you start screening.
        Here are three ways to get started.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
        {steps.map(({ icon: Icon, title, desc, path, cta }) => (
          <div key={title} className="p-5 rounded-xl border text-left"
            style={{ borderColor: 'var(--dash-border)' }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: 'rgba(201,169,110,0.1)' }}>
              <Icon className="w-5 h-5" style={{ color: '#C9A96E' }} />
            </div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>{title}</h3>
            <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--dash-text-tertiary)' }}>{desc}</p>
            <button onClick={() => navigate(path)}
              className="text-xs font-medium cursor-pointer" style={{ color: '#C9A96E' }}>
              {cta} &rarr;
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
