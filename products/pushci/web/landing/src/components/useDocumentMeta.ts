import { useEffect } from 'react'

interface DocumentMeta {
  title: string
  description: string
  canonical?: string
  jsonLd?: Record<string, unknown>
  robots?: string
}

export function useDocumentMeta({ title, description, canonical, jsonLd, robots }: DocumentMeta) {
  useEffect(() => {
    document.title = title

    const setMeta = (name: string, content: string, attr = 'name') => {
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, name)
        document.head.appendChild(el)
      }
      el.content = content
    }

    setMeta('description', description)
    setMeta('og:title', title, 'property')
    setMeta('og:description', description, 'property')
    setMeta('twitter:title', title, 'name')
    setMeta('twitter:description', description, 'name')

    if (robots) {
      setMeta('robots', robots)
    }

    if (canonical) {
      setMeta('og:url', canonical, 'property')
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
      if (link) link.href = canonical
    }

    let scriptEl: HTMLScriptElement | null = null
    if (jsonLd) {
      scriptEl = document.createElement('script')
      scriptEl.type = 'application/ld+json'
      scriptEl.id = 'page-jsonld'
      scriptEl.textContent = JSON.stringify(jsonLd)
      const existing = document.getElementById('page-jsonld')
      if (existing) existing.remove()
      document.head.appendChild(scriptEl)
    }

    return () => {
      if (scriptEl) scriptEl.remove()
    }
  }, [title, description, canonical, jsonLd])
}
