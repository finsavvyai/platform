import { useState } from 'react'

interface CodeBlockProps {
  code: string
  language?: string
}

// CodeBlock renders a pre-formatted code sample with a "Copy" button
// that swaps to "Copied!" for two seconds after a successful copy.
// The navigator.clipboard API is preferred; we fall back to a textarea
// trick when running in an insecure context or an older browser.
export function CodeBlock({ code, language = 'yaml' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code)
      } else {
        const ta = document.createElement('textarea')
        ta.value = code
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Swallow — the worst case is the user manually selects + copies.
    }
  }

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy code to clipboard"
        className="absolute top-3 right-3 z-10 px-2.5 py-1 text-[11px] font-medium
                   rounded-md border border-border-base bg-surface/90 text-t2
                   hover:text-t1 hover:border-accent/40 transition
                   opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre
        className="rounded-xl border border-border-base bg-surface p-5
                   overflow-x-auto text-[13px] leading-6 font-mono text-t2"
        data-language={language}
      >
        <code>{code}</code>
      </pre>
    </div>
  )
}
