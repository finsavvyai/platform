import React from 'react'
import { Check } from 'lucide-react'

export function LemonSqueezySetup() {
  const webhookUrl = 'https://api.amliq.finance/webhooks/lemonsqueezy'
  const lastWebhook = '2026-03-26T14:32:00Z'
  const connectedProducts = ['api', 'dashboard', 'sdk', 'iframe', 'dataset']

  return (
    <div className="space-y-lg">
      <div className="glass-card rounded-apple-lg p-lg">
        <h3 className="sf-body font-medium mb-md sf-title">LemonSqueezy Integration Status</h3>
        <div className="space-y-md">
          <div>
            <label className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>Webhook URL</label>
            <div className="mt-xs flex gap-xs">
              <input type="text" value={webhookUrl} readOnly className="input-field flex-1" />
              <button className="button-secondary">Copy</button>
            </div>
          </div>
          <div>
            <label className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>Last Webhook Received</label>
            <p className="mt-xs sf-body" style={{ color: 'var(--dash-text)' }}>
              {new Date(lastWebhook).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-apple-lg p-lg">
        <h3 className="sf-body font-medium mb-md sf-title">Connected Products</h3>
        <div className="space-y-xs">
          {connectedProducts.map(product => (
            <div key={product} className="flex items-center gap-md p-sm rounded-apple-md"
              style={{ background: 'var(--dash-surface)' }}>
              <Check className="w-4 h-4 text-apple-green" />
              <span className="sf-caption capitalize" style={{ color: 'var(--dash-text)' }}>{product}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
