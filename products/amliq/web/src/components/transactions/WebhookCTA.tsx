import { useNavigate } from 'react-router-dom'
import { Webhook, ArrowRight, Zap, Shield, Code } from 'lucide-react'

const STEPS = [
  { icon: Code, title: 'Get your API key', desc: 'Generate a key from Settings > API Keys' },
  { icon: Webhook, title: 'Configure webhook', desc: 'Point your payment system to our endpoint' },
  { icon: Zap, title: 'Screen in real-time', desc: 'Every transaction is screened automatically' },
] as const

export function WebhookCTA() {
  const navigate = useNavigate()

  return (
    <div className="rounded-apple-lg border border-white/[0.08] bg-gradient-to-br from-[#C9A96E]/[0.06] to-transparent p-xl text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#C9A96E]/10 mb-lg">
        <Shield className="w-7 h-7 text-[#C9A96E]" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-sm">
        Connect your payment system
      </h3>
      <p className="sf-caption max-w-md mx-auto mb-xl">
        Attach a webhook to screen every transaction in real-time against
        global sanctions lists. Get alerts within milliseconds.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-lg mb-xl max-w-2xl mx-auto">
        {STEPS.map((step, i) => (
          <div key={i} className="flex flex-col items-center gap-sm">
            <div className="flex items-center justify-center w-10 h-10 rounded-apple-md bg-white/[0.06]">
              <step.icon className="w-5 h-5 text-[#C9A96E]" />
            </div>
            <p className="text-sm font-medium text-white">{step.title}</p>
            <p className="text-xs text-apple-label-secondary">{step.desc}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-md">
        <button
          onClick={() => navigate('/webhooks')}
          className="flex items-center gap-sm px-xl py-md text-sm font-semibold rounded-apple-md transition-all duration-200 hover:-translate-y-px cursor-pointer"
          style={{ background: '#1A1814', color: '#FAFAF8' }}
        >
          <Webhook className="w-4 h-4" />
          Set Up Webhook
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => navigate('/api-keys')}
          className="flex items-center gap-sm px-xl py-md border border-white/10
            hover:bg-white/5 text-white text-sm font-medium rounded-apple-md
            transition-colors cursor-pointer"
        >
          <Code className="w-4 h-4" />
          Get API Key
        </button>
      </div>
      <div className="mt-lg">
        <code className="text-xs text-apple-label-tertiary bg-white/[0.04] px-md py-sm rounded-apple">
          POST https://api.amliq.finance/api/v1/transactions/screen
        </code>
      </div>
    </div>
  )
}
