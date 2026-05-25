'use client'

import { useEffect, useState } from 'react'
import { List } from 'lucide-react'

import type { Doc } from 'contentlayer/generated'

interface TocItem {
  id: string
  text: string
  level: number
}

interface TableOfContentsProps {
  doc: Doc
}

export function TableOfContents({ doc }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>()
  const [items, setItems] = useState<TocItem[]>([])

  useEffect(() => {
    // Extract headings from the document content
    const headings = doc.body.raw.match(/^###?\s.+$/gm) || []

    const tocItems = headings.map((heading) => {
      const level = heading.startsWith('###') ? 3 : 2
      const text = heading.replace(/^#+\s/, '')
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-')

      return { id, text, level }
    })

    setItems(tocItems)
  }, [doc])

  useEffect(() => {
    // Handle scroll-based active heading detection
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      { rootMargin: '0px 0px -80% 0px' }
    )

    // Observe all heading elements
    document.querySelectorAll('h2, h3').forEach((heading) => {
      observer.observe(heading)
    })

    return () => observer.disconnect()
  }, [])

  const handleClick = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  if (items.length === 0) {
    return null
  }

  return (
    <div className="toc">
      <div className="flex items-center space-x-2 mb-4">
        <List className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">On this page</h3>
      </div>

      <nav>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => handleClick(item.id)}
                className={`toc-link level-${item.level} ${
                  activeId === item.id ? 'active' : ''
                }`}
              >
                {item.text}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}