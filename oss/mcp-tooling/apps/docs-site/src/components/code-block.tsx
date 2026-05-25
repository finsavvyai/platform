'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@mcpoverflow/ui'

interface CodeBlockProps {
  code: string
  language?: string
  showLineNumbers?: boolean
}

export function CodeBlock({ code, language = 'typescript', showLineNumbers = true }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lines = code.split('\n')
  const maxLineNumber = lines.length.toString().length

  return (
    <div className="code-block">
      {/* Language and Copy Button */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase">
          {language}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="copy-button text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>

      {/* Code Content */}
      <div className="relative overflow-x-auto">
        <pre className="p-4 text-sm leading-relaxed">
          <code className={`language-${language}`}>
            {showLineNumbers ? (
              <table className="w-full">
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={index}>
                      <td
                        className="text-right text-muted-foreground select-none pr-4"
                        style={{ width: `${maxLineNumber + 1}ch` }}
                      >
                        {index + 1}
                      </td>
                      <td className="text-left">
                        {line || ' '}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              lines.map((line, index) => (
                <div key={index}>
                  {line || ' '}
                </div>
              ))
            )}
          </code>
        </pre>
      </div>
    </div>
  )
}