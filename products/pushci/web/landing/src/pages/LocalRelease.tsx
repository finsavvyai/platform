import { Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { ViralShare } from '../components/ViralShare'
import { ReleaseCostTable } from '../components/ReleaseCostTable'
import { useDocumentMeta } from '../components/useDocumentMeta'

const steps = [
  { n: '1', title: 'Tag your release', cmd: 'git tag v1.2.0' },
  { n: '2', title: 'Run the release', cmd: 'pushci release' },
  { n: '3', title: 'Done', cmd: 'GitHub Release + Homebrew + npm' },
]

const terminal = `$ pushci release
  Detected: Go 1.22 + .goreleaser.yml
  Building darwin/amd64, darwin/arm64, linux/amd64...
  Building linux/arm64, windows/amd64, windows/arm64...
  Creating GitHub Release v1.2.0...
  Updating Homebrew tap...
  Publishing to npm...
  Done in 47s. Saved $0.96 vs GitHub Actions.`

export default function LocalRelease() {
  useDocumentMeta({
    title: 'Local Release — Build & Ship from Your Machine | PushCI',
    description: 'Run GoReleaser locally. 6 platforms. GitHub Release. Homebrew. npm. $0.',
    canonical: 'https://pushci.dev/release',
  })

  return (
    <div className="min-h-screen bg-root">
      <Navbar />
      <div className="mx-auto max-w-[1080px] px-4 sm:px-6 pt-28 sm:pt-36 pb-20">
        <p className="text-sm font-medium text-accent tracking-wide">Local Release</p>
        <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-t1 max-w-2xl">
          So you're telling me we've been paying GitHub to run{' '}
          <span className="gradient-text">go build</span> on THEIR computer?
        </h1>
        <p className="mt-4 text-lg text-t2 max-w-lg leading-relaxed">
          Your machine compiles your code for free every day. But somehow we decided
          to rent a computer in Virginia to do it instead.
        </p>

        <h2 className="mt-16 text-2xl font-bold text-t1">Three steps. That's it.</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-lg border border-border-base bg-surface p-5">
              <span className="text-accent font-mono text-sm">Step {s.n}</span>
              <p className="mt-2 text-t1 font-medium">{s.title}</p>
              <code className="mt-2 block text-sm font-mono text-t3">{s.cmd}</code>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-lg border border-border-base bg-surface overflow-hidden">
          <div className="border-b border-border-base/60 px-4 py-2 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500/60" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <span className="w-3 h-3 rounded-full bg-green-500/60" />
            <span className="ml-2 text-[11px] font-mono text-t3">terminal</span>
          </div>
          <pre className="p-4 text-sm font-mono text-t2 leading-relaxed overflow-x-auto">
            {terminal}
          </pre>
        </div>

        <h2 className="mt-16 text-2xl font-bold text-t1">The math is embarrassing</h2>
        <p className="mt-2 text-sm text-t3 mb-6">Weekly releases, 6 platform matrix builds.</p>
        <ReleaseCostTable />

        <div className="mt-10 flex flex-wrap gap-4 items-center">
          <a href="/#pricing" className="rounded-lg bg-t1 px-5 py-2.5 text-sm font-semibold text-root hover:bg-white transition">
            Install PushCI
          </a>
          <Link to="/tools/cost-calculator" className="text-sm text-t2 hover:text-t1 transition">
            Full cost calculator
          </Link>
        </div>
        <div className="mt-8">
          <ViralShare context="Share the release savings" />
        </div>
      </div>
      <Footer />
    </div>
  )
}
