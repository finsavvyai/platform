import React from 'react'
import { cn } from '@/lib/utils'

interface CodeBlockProps {
  language: string
  code: string
  className?: string
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  language,
  code,
  className,
}) => {
  return (
    <pre
      className={cn(
        'rounded-md bg-muted p-4 overflow-x-auto text-sm',
        className
      )}
    >
      <code className={`language-${language}`}>{code}</code>
    </pre>
  )
}
