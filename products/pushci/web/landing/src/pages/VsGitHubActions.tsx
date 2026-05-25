import { ComparisonHero } from '../components/ComparisonHero'
import { ComparisonTable } from '../components/ComparisonTable'
import { MigrationBlock } from '../components/MigrationBlock'
import { Footer } from '../components/Footer'
import { Navbar } from '../components/Navbar'
import { useDocumentMeta } from '../components/useDocumentMeta'

const features = [
  { name: 'Setup', pushci: 'npx pushci init', competitor: '50+ line YAML' },
  { name: 'Configuration', pushci: 'Auto-detected', competitor: 'Manual YAML' },
  { name: 'Hosted runner cost', pushci: 'Free forever', competitor: '$0.0048/min (Jan 2026 cut)' },
  { name: 'Self-hosted runner cost', pushci: '$0 always', competitor: '$0.002/min since Mar 2026' },
  { name: 'AI Pipeline Gen', pushci: 'yes', competitor: 'no' },
  { name: 'Multi-Platform', pushci: 'yes', competitor: 'GitHub only' },
  { name: 'Local Runs', pushci: 'yes', competitor: 'no' },
  { name: 'Auto-Detect Stack', pushci: 'yes', competitor: 'no' },
  { name: 'Deploy Targets', pushci: '22 built-in', competitor: 'Via marketplace' },
  { name: 'Vendor Lock-in', pushci: 'None', competitor: 'GitHub-only' },
]

const selfHostedCallout = `In March 2026, GitHub started charging $0.002/min for self-hosted runners — a feature that was free since 2019. The community backlash was immediate. PushCI has always been $0 for local compute. That will never change.`

const beforeCode = `# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test
      - run: npm run build`

export default function VsGitHubActions() {
  useDocumentMeta({
    title: 'PushCI vs GitHub Actions — Free Zero-Config CI/CD Alternative',
    description: 'Compare PushCI vs GitHub Actions. PushCI auto-detects your stack with AI, runs locally for free, and eliminates YAML config. Switch from GitHub Actions in 30 seconds.',
    canonical: 'https://pushci.dev/vs/github-actions',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'PushCI vs GitHub Actions',
      description: 'Detailed comparison between PushCI and GitHub Actions CI/CD platforms',
      url: 'https://pushci.dev/vs/github-actions',
      mainEntity: {
        '@type': 'SoftwareApplication',
        name: 'PushCI',
        applicationCategory: 'DeveloperApplication',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
    },
  })
  return (
    <div className="min-h-screen bg-root">
      <Navbar />
      <ComparisonHero
        title="PushCI vs GitHub Actions"
        subtitle="Stop writing YAML. Stop paying per minute. PushCI auto-detects your stack and runs CI locally for free."
        competitor="GitHub Actions"
      />
      <ComparisonTable features={features} competitorName="GitHub Actions" />
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-5">
          <p className="text-sm font-semibold text-yellow-400 mb-1">March 2026 pricing change</p>
          <p className="text-sm text-gray-300">{selfHostedCallout}</p>
        </div>
      </div>
      <MigrationBlock beforeCode={beforeCode} beforeLabel="GitHub Actions YAML" />
      <Footer />
    </div>
  )
}
