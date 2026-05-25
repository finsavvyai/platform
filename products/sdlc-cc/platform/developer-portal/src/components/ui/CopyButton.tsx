import React, { useState } from 'react'
import { cn } from '@/lib/utils'

interface CopyButtonProps {
  value: string
  className?: string
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  value,
  className,
}) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted',
        className
      )}
      aria-label="Copy to clipboard"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}
