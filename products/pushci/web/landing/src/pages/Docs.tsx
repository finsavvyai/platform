import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { useDocumentMeta } from '../components/useDocumentMeta'
import { coreSections } from './DocsData'
import { extSections } from './DocsDataExt'
import { DocsSidebar, Section } from './DocsSection'

const allSections = [...coreSections, ...extSections]

export default function Docs() {
  useDocumentMeta({
    title: 'Documentation — PushCI',
    description: 'PushCI docs: installation, CLI commands, configuration, runners, artifacts, API reference, examples, and skills marketplace.',
    canonical: 'https://pushci.dev/docs',
  })

  return (
    <div className="min-h-screen bg-root">
      <Navbar />

      <section className="pt-28 sm:pt-36 pb-8 px-4 sm:px-6">
        <div className="mx-auto max-w-[1080px]">
          <p className="text-sm font-medium text-accent tracking-wide">Docs</p>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-t1">
            PushCI Documentation
          </h1>
          <p className="mt-4 text-lg text-t2 max-w-xl leading-relaxed">
            Everything you need to run CI/CD on your own machine.
            Zero config, zero cost, zero vendor lock-in.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1080px] px-4 sm:px-6 pb-20">
        <div className="grid lg:grid-cols-[200px_1fr] gap-10">
          <DocsSidebar />
          <div className="space-y-12">
            <div className="rounded-xl border border-accent/30 bg-surface p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <h3 className="text-base font-semibold text-t1">
                  Looking for the full <code className="text-accent">pushci.yml</code> reference?
                </h3>
                <p className="text-sm text-t3 mt-1 leading-relaxed">
                  Interactive guide with simple, complex, and GitHub
                  Actions-compatible examples plus every field documented.
                </p>
              </div>
              <a
                href="/docs/pushci-yaml"
                className="shrink-0 px-4 py-2 rounded-lg bg-accent text-black text-sm font-medium hover:bg-accent/90 transition whitespace-nowrap"
              >
                Open guide →
              </a>
            </div>
            {allSections.map((s) => (
              <Section key={s.id} section={s} />
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
