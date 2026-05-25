import { ComparisonHero } from '../components/ComparisonHero'
import { ComparisonTable } from '../components/ComparisonTable'
import { MigrationBlock } from '../components/MigrationBlock'
import { Footer } from '../components/Footer'
import { Navbar } from '../components/Navbar'
import { useDocumentMeta } from '../components/useDocumentMeta'

const features = [
  { name: 'Setup', pushci: '30 seconds', competitor: '.travis.yml + account' },
  { name: 'Configuration', pushci: 'AI auto-detected', competitor: 'Manual YAML' },
  { name: 'Cost', pushci: 'Free forever', competitor: '$69/mo+ (no free tier)' },
  { name: 'AI Pipeline Gen', pushci: 'yes', competitor: 'no' },
  { name: 'Status', pushci: 'Actively developed', competitor: 'Zombie (ecosystem left in 2020)' },
  { name: 'Open-source support', pushci: 'Always free', competitor: 'Eliminated 2020' },
  { name: 'Local Runs', pushci: 'yes', competitor: 'no' },
  { name: 'Auto-Detect Stack', pushci: 'yes', competitor: 'Limited' },
  { name: 'Deploy Targets', pushci: '16 built-in', competitor: 'Provider-specific config' },
  { name: 'Multi-Platform', pushci: 'GH + GL + BB', competitor: 'GitHub only (now)' },
]

const travisNote = `Travis CI eliminated its open-source free tier in 2020. The community left immediately — R, Python, Ruby, and Node.js ecosystems all officially moved their projects away. The GitHub stars went flat. The blog went quiet. If you're still on Travis CI, you're not maintaining a CI pipeline, you're maintaining a zombie. Migrate now before the next pricing change makes the decision for you.`

const beforeCode = `# .travis.yml
language: node_js
node_js:
  - "20"
cache: npm
install:
  - npm ci
script:
  - npm test
  - npm run build
deploy:
  provider: pages
  skip_cleanup: true
  token: $GITHUB_TOKEN`

export default function VsTravisCI() {
  useDocumentMeta({
    title: 'PushCI vs Travis CI — Free CI/CD That Actually Works',
    description: 'Compare PushCI vs Travis CI. Travis CI killed their free tier. PushCI is free forever, AI-powered, and runs on your machine. Migrate in 30 seconds.',
    canonical: 'https://pushci.dev/vs/travis-ci',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'PushCI vs Travis CI',
      description: 'Detailed comparison between PushCI and Travis CI platforms',
      url: 'https://pushci.dev/vs/travis-ci',
    },
  })
  return (
    <div className="min-h-screen bg-root">
      <Navbar />
      <ComparisonHero
        title="PushCI vs Travis CI"
        subtitle="Travis CI killed their free tier and lost developer trust. PushCI is free forever and runs on your machine."
        competitor="Travis CI"
      />
      <ComparisonTable features={features} competitorName="Travis CI" />
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="rounded-lg border border-red-700/40 bg-red-900/20 p-5">
          <p className="text-sm font-semibold text-red-400 mb-1">Travis CI is effectively dead</p>
          <p className="text-sm text-gray-300">{travisNote}</p>
        </div>
      </div>
      <MigrationBlock beforeCode={beforeCode} beforeLabel="Travis CI YAML" />
      <Footer />
    </div>
  )
}
