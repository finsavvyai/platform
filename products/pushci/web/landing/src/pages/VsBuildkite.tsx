import { ComparisonHero } from '../components/ComparisonHero'
import { ComparisonTable } from '../components/ComparisonTable'
import { MigrationBlock } from '../components/MigrationBlock'
import { Footer } from '../components/Footer'
import { Navbar } from '../components/Navbar'
import { useDocumentMeta } from '../components/useDocumentMeta'

const features = [
  { name: 'Setup', pushci: '30 seconds', competitor: 'Agent install + YAML' },
  { name: 'Configuration', pushci: 'AI auto-detected', competitor: 'pipeline.yml + Bash' },
  { name: 'Cost', pushci: 'Free forever', competitor: '$15/user/mo (no free plan)' },
  { name: 'AI Pipeline Gen', pushci: 'yes', competitor: 'no' },
  { name: 'Self-Hosted Runner', pushci: 'Built-in (zero setup)', competitor: 'Requires agent installation' },
  { name: 'Local Runs', pushci: 'yes', competitor: 'Agent-based only' },
  { name: 'Auto-Detect Stack', pushci: 'yes', competitor: 'no' },
  { name: 'Deploy Targets', pushci: '16 built-in', competitor: 'Custom plugins' },
  { name: 'Solo Developer', pushci: 'Perfect (free)', competitor: 'Expensive for individuals' },
]

const beforeCode = `# .buildkite/pipeline.yml
steps:
  - label: ":npm: Install"
    command: "npm ci"
  - label: ":test_tube: Test"
    command: "npm test"
    depends_on: "Install"
  - label: ":rocket: Build"
    command: "npm run build"
    depends_on: "Test"
  - label: ":ship: Deploy"
    command: "./deploy.sh"
    depends_on: "Build"`

const buildkiteNote = `After GitHub started charging for self-hosted runners in March 2026, Buildkite marketed itself as the alternative. It still charges $30/user/month (Pro plan) and still requires you to write YAML. PushCI is $0, writes zero YAML, and never charges a platform fee for your own hardware.`

export default function VsBuildkite() {
  useDocumentMeta({
    title: 'PushCI vs Buildkite — $0 vs $30/user/mo CI/CD',
    description: 'Compare PushCI vs Buildkite. Get the same self-hosted CI/CD experience for free. AI auto-detects your stack, no agent installation needed.',
    canonical: 'https://pushci.dev/vs/buildkite',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'PushCI vs Buildkite',
      description: 'Detailed comparison between PushCI and Buildkite CI/CD platforms',
      url: 'https://pushci.dev/vs/buildkite',
    },
  })
  return (
    <div className="min-h-screen bg-root">
      <Navbar />
      <ComparisonHero
        title="PushCI vs Buildkite"
        subtitle="Buildkite charges $15/user/month for what PushCI does for free. Zero config, zero cost, zero compromise."
        competitor="Buildkite"
      />
      <ComparisonTable features={features} competitorName="Buildkite" />
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-5">
          <p className="text-sm font-semibold text-orange-400 mb-1">2026 market context</p>
          <p className="text-sm text-gray-300">{buildkiteNote}</p>
        </div>
      </div>
      <MigrationBlock beforeCode={beforeCode} beforeLabel="Buildkite Pipeline YAML" />
      <Footer />
    </div>
  )
}
