import { useState } from 'react'
import { Share2, MessageCircle, Linkedin, Mail, Copy, Check } from 'lucide-react'
import type { ScreenResponse } from '../../types'

interface Props {
  data: ScreenResponse
}

function buildSummary(data: ScreenResponse): string {
  const matches = data.matches ?? []
  if (matches.length === 0) {
    return `AMLIQ Screening Report\n\nEntity: ${data.query}\nResult: CLEAR - No sanctions matches found\nProcessing: ${data.processing_time_ms ?? 0}ms\n\nScreened by AMLIQ - AI-Enhanced Sanctions Screening\nhttps://amliq.finance`
  }
  const top = matches.slice(0, 3)
  const lines = top.map(
    (m) => `- ${m.entity_name} (${m.list_id}) — ${(m.confidence * 100).toFixed(0)}% confidence`,
  )
  return `AMLIQ Screening Report\n\nEntity: ${data.query}\nMatches: ${data.total_matches ?? matches.length}\n${lines.join('\n')}\nProcessing: ${data.processing_time_ms ?? 0}ms\n\nScreened by AMLIQ - AI-Enhanced Sanctions Screening\nhttps://amliq.finance`
}

function buildSubject(data: ScreenResponse): string {
  const count = data.total_matches ?? data.matches?.length ?? 0
  return count === 0
    ? `AMLIQ: ${data.query} — CLEAR`
    : `AMLIQ: ${data.query} — ${count} match${count > 1 ? 'es' : ''} found`
}

export function ShareResults({ data }: Props) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  const summary = buildSummary(data)
  const subject = buildSubject(data)
  const encoded = encodeURIComponent(summary)
  const encodedSubject = encodeURIComponent(subject)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const channels = [
    {
      name: 'WhatsApp',
      icon: MessageCircle,
      color: 'hover:bg-[#25D366]/20 hover:text-[#25D366]',
      href: `https://wa.me/?text=${encoded}`,
    },
    {
      name: 'LinkedIn',
      icon: Linkedin,
      color: 'hover:bg-[#0A66C2]/20 hover:text-[#0A66C2]',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://amliq.finance')}&summary=${encoded}`,
    },
    {
      name: 'Email',
      icon: Mail,
      color: 'hover:bg-[#C9A96E]/20 hover:text-[#C9A96E]',
      href: `mailto:?subject=${encodedSubject}&body=${encoded}`,
    },
  ]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-xs px-md py-sm rounded-apple-md border border-white/10 hover:bg-white/5 text-apple-label-secondary hover:text-white transition-colors cursor-pointer text-sm"
      >
        <Share2 className="w-4 h-4" />
        Share
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-sm z-50 w-56 rounded-apple-lg border border-white/10 bg-apple-bg-secondary shadow-xl p-sm">
          <p className="text-xs text-apple-label-tertiary px-md py-xs mb-xs">
            Share screening results
          </p>
          {channels.map((ch) => (
            <a
              key={ch.name}
              href={ch.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-md px-md py-sm rounded-apple-md text-sm text-apple-label-secondary transition-colors ${ch.color}`}
            >
              <ch.icon className="w-4 h-4" />
              {ch.name}
            </a>
          ))}
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-md px-md py-sm rounded-apple-md text-sm text-apple-label-secondary hover:bg-white/10 hover:text-white transition-colors w-full cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-apple-green" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
        </div>
      )}
    </div>
  )
}
