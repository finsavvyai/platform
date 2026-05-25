import Link from 'next/link'
import { ArrowLeft, Calendar, Clock, Tag, Edit } from 'lucide-react'

import { Button } from '@mcpoverflow/ui'
import { InteractiveDemo } from '@/components/interactive-demo'
import { CodeBlock } from '@/components/code-block'

import type { Doc } from 'contentlayer/generated'

interface DocPageProps {
  doc: Doc
}

export function DocPage({ doc }: DocPageProps) {
  return (
    <article className="doc-content">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
        <Link href="/docs" className="hover:text-foreground">
          Documentation
        </Link>
        <span>/</span>
        <span className="text-foreground">{doc.title}</span>
      </nav>

      {/* Header */}
      <header className="mb-8 pb-8 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            {doc.tags?.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
              >
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </span>
            ))}
          </div>

          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Edit className="h-4 w-4 mr-2" />
            Edit on GitHub
          </Button>
        </div>

        <h1 className="text-4xl font-bold mb-4">{doc.title}</h1>

        {doc.description && (
          <p className="text-xl text-muted-foreground mb-6">{doc.description}</p>
        )}

        <div className="flex items-center space-x-6 text-sm text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Calendar className="h-4 w-4" />
            <span>Last updated: {doc.date ? new Date(doc.date).toLocaleDateString() : 'Recently'}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Clock className="h-4 w-4" />
            <span>Reading time: {doc.estimatedReadingTime || '5 min'}</span>
          </div>
        </div>
      </header>

      {/* Table of Contents (Mobile) */}
      <div className="lg:hidden mb-8 p-4 bg-muted/30 rounded-lg">
        <h3 className="font-semibold mb-3">On this page</h3>
        <p className="text-sm text-muted-foreground">
          Use the sidebar navigation to browse different sections of this document.
        </p>
      </div>

      {/* Content */}
      <div className="prose prose-slate max-w-none dark:prose-invert">
        <doc.body />

        {/* Interactive Demos */}
        {doc.slug.includes('examples') && (
          <section className="mt-12">
            <h2>Interactive Demo</h2>
            <InteractiveDemo example={doc.slug} />
          </section>
        )}

        {/* Callouts */}
        {doc.slug.includes('getting-started') && (
          <div className="callout info mt-8">
            <h4 className="font-semibold mb-2">💡 Pro Tip</h4>
            <p>
              Start with our Quick Start guide to get your first agent running in minutes.
              You can always come back to explore more advanced features later.
            </p>
          </div>
        )}

        {doc.slug.includes('security') && (
          <div className="callout warning mt-8">
            <h4 className="font-semibold mb-2">⚠️ Important</h4>
            <p>
              Always secure your API keys and follow security best practices when deploying agents to production.
            </p>
          </div>
        )}
      </div>

      {/* Next/Previous Navigation */}
      <nav className="mt-16 pt-8 border-t border-border">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Previous Link */}
          <div className="text-left">
            <Button variant="ghost" className="p-0 h-auto font-normal">
              <ArrowLeft className="h-4 w-4 mr-2" />
              <div className="text-left">
                <div className="text-sm text-muted-foreground">Previous</div>
                <div className="text-foreground">Installation</div>
              </div>
            </Button>
          </div>

          {/* Next Link */}
          <div className="text-right">
            <Button variant="ghost" className="p-0 h-auto font-normal ml-auto">
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Next</div>
                <div className="text-foreground">Configuration</div>
              </div>
              <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Edit Link */}
      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground">
          Found a typo or want to improve this documentation?{' '}
          <a
            href={`https://github.com/mcpoverflow/mcpoverflow/edit/main/docs/${doc.slug}.mdx`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 hover:text-purple-700 underline"
          >
            Edit this page on GitHub
          </a>
        </p>
      </div>
    </article>
  )
}