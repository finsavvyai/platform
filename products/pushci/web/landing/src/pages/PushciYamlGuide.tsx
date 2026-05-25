import { useMemo, useState } from 'react'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { CodeBlock } from '../components/CodeBlock'
import { TabGroup, Tab } from '../components/TabGroup'
import { useDocumentMeta } from '../components/useDocumentMeta'
import { examples } from './PushciYamlGuideData'
import { fieldReference } from './PushciYamlFieldRef'

// Interactive guide for pushci.yml syntax. Three tabs with real
// examples, an exhaustive field reference with search, and clear
// copy buttons on every code block. Designed so a user can go from
// "never seen PushCI" to "shipping production workflows" in one page.
export default function PushciYamlGuide() {
  useDocumentMeta({
    title: 'pushci.yml Syntax Guide — PushCI',
    description:
      'Interactive reference for every pushci.yml field with simple, ' +
      'complex, and GitHub Actions-compatible examples. Copy, customize, ship.',
    canonical: 'https://pushci.dev/docs/pushci-yaml',
  })

  const tabs: Tab[] = examples.map((ex) => ({
    id: ex.id,
    label: ex.label,
    description: ex.description,
    content: <CodeBlock code={ex.code} language="yaml" />,
  }))

  return (
    <div className="min-h-screen bg-root">
      <Navbar />

      <section className="pt-28 sm:pt-36 pb-8 px-4 sm:px-6">
        <div className="mx-auto max-w-[1080px]">
          <p className="text-sm font-medium text-accent tracking-wide">Docs</p>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-t1">
            pushci.yml Syntax Guide
          </h1>
          <p className="mt-4 text-lg text-t2 max-w-2xl leading-relaxed">
            Three example tiers from zero-config to full GitHub Actions
            compatibility, plus a searchable reference for every field.
            Copy anything, paste into your repo, and you're shipping.
          </p>
        </div>
      </section>

      <section className="px-4 sm:px-6">
        <div className="mx-auto max-w-[1080px]">
          <h2 className="text-2xl font-bold text-t1 mb-2">Examples</h2>
          <p className="text-sm text-t3 mb-6 max-w-[70ch] leading-relaxed">
            Switch tabs to compare the three authoring styles. All three
            execute end-to-end on PushCI today.
          </p>
          <TabGroup tabs={tabs} defaultTabId="simple" />
        </div>
      </section>

      <FieldReference />

      <CallToAction />

      <Footer />
    </div>
  )
}

// FieldReference is the searchable table of every pushci.yml field.
// The search is a plain case-insensitive substring match over path
// and description — no fuzzy lib required. Split into its own
// component so it owns its own filter state.
function FieldReference() {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return fieldReference
    return fieldReference.filter(
      (f) =>
        f.path.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.type.toLowerCase().includes(q),
    )
  }, [query])

  return (
    <section className="px-4 sm:px-6 pt-16">
      <div className="mx-auto max-w-[1080px]">
        <h2 className="text-2xl font-bold text-t1 mb-2">Field reference</h2>
        <p className="text-sm text-t3 mb-4 max-w-[70ch] leading-relaxed">
          Every field supported by <code className="text-accent">pushci.yml</code>, mirrored
          from <code className="text-accent">internal/config/config.go</code>. Type a keyword
          to filter.
        </p>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search field name, type, or description..."
          className="w-full max-w-md mb-6 px-4 py-2 rounded-lg border border-border-base
                     bg-surface text-t1 placeholder:text-t3
                     focus:outline-none focus:border-accent transition"
        />

        <div className="rounded-xl border border-border-base bg-surface overflow-hidden">
          {filtered.length === 0 && (
            <p className="p-6 text-center text-sm text-t3">
              No fields match "{query}". Try a different keyword.
            </p>
          )}
          {filtered.map((f, i) => (
            <div
              key={f.path}
              className={
                'p-4 sm:p-5 ' +
                (i > 0 ? 'border-t border-border-base/40' : '')
              }
            >
              <div className="flex flex-wrap items-baseline gap-3">
                <code className="text-sm font-mono text-accent">{f.path}</code>
                <span className="text-[11px] uppercase tracking-wide text-t3 font-medium">
                  {f.type}
                </span>
              </div>
              <p className="mt-2 text-sm text-t2 leading-relaxed max-w-[75ch]">
                {f.description}
              </p>
              {f.example && (
                <pre className="mt-3 text-[12px] leading-5 font-mono text-t2 bg-root/40 rounded-md p-3 overflow-x-auto">
                  <code>{f.example}</code>
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// CallToAction nudges the reader toward actually running pushci after
// they've finished reading the guide. Everything links somewhere real.
function CallToAction() {
  return (
    <section className="px-4 sm:px-6 py-16">
      <div className="mx-auto max-w-[1080px] rounded-2xl border border-accent/30 bg-surface p-8 text-center">
        <h2 className="text-2xl font-bold text-t1 mb-3">Ready to ship?</h2>
        <p className="text-t2 max-w-xl mx-auto mb-6 leading-relaxed">
          Drop any of the examples above into your repo as{' '}
          <code className="text-accent">pushci.yml</code>, then run{' '}
          <code className="text-accent">npx pushci run</code>. No login, no
          signup, no config wizard.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="/docs"
            className="px-5 py-2.5 rounded-lg border border-border-base text-t1 hover:border-accent/40 transition"
          >
            Full docs
          </a>
          <a
            href="https://github.com/finsavvyai/pushci"
            className="px-5 py-2.5 rounded-lg bg-accent text-black font-medium hover:bg-accent/90 transition"
          >
            GitHub
          </a>
        </div>
      </div>
    </section>
  )
}
