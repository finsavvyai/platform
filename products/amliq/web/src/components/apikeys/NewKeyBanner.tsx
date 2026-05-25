import { useState } from 'react'
import { Button } from '../ui/Button'

export function NewKeyBanner({ keyValue }: { keyValue: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(keyValue); setCopied(true) }
  return (
    <div className="mt-lg p-lg rounded-apple-md bg-apple-green/10 border border-apple-green/20">
      <p className="sf-caption text-apple-green font-semibold mb-sm">Key generated — save it now!</p>
      <div className="flex items-center gap-md">
        <code className="text-sm bg-black/30 px-md py-sm rounded flex-1 font-mono truncate"
          style={{ color: 'var(--dash-text)' }}>{keyValue}</code>
        <Button size="sm" onClick={copy}>{copied ? 'Copied!' : 'Copy'}</Button>
      </div>
    </div>
  )
}
