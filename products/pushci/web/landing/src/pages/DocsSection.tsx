import type { DocSection } from './DocsData'

const navItems = [
  { id: 'quick-start', label: 'Quick Start' },
  { id: 'installation', label: 'Installation' },
  { id: 'commands', label: 'Commands' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'runners', label: 'Runners' },
  { id: 'artifacts', label: 'Artifacts' },
  { id: 'api', label: 'API' },
  { id: 'examples', label: 'Examples' },
  { id: 'skills', label: 'Skills' },
]

export function DocsSidebar() {
  return (
    <nav className="hidden lg:block sticky top-28 space-y-1" aria-label="Docs navigation">
      {navItems.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="block px-3 py-1.5 text-sm text-t3 hover:text-t1 rounded-lg transition"
        >
          {item.label}
        </a>
      ))}
    </nav>
  )
}

export function Section({ section }: { section: DocSection }) {
  return (
    <section id={section.id} className="scroll-mt-28">
      <h2 className="text-xl font-bold text-t1 mb-4 border-b border-border-base/40 pb-2">
        {section.title}
      </h2>
      <pre className="rounded-xl border border-border-base bg-surface p-5 overflow-x-auto text-[13px] leading-6 font-mono text-t2">
        <code>{section.content}</code>
      </pre>
    </section>
  )
}
