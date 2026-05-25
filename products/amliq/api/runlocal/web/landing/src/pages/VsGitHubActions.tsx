import { ComparisonHero } from '../components/ComparisonHero'
import { ComparisonTable } from '../components/ComparisonTable'
import { MigrationBlock } from '../components/MigrationBlock'
import { Footer } from '../components/Footer'
import { Navbar } from '../components/Navbar'

const features = [
  { name: 'Setup', pushci: 'npx pushci init', competitor: '50+ line YAML' },
  { name: 'Configuration', pushci: 'Auto-detected', competitor: 'Manual YAML' },
  { name: 'Cost', pushci: 'Free forever', competitor: '$0.008/min (adds up)' },
  { name: 'AI Pipeline Gen', pushci: 'yes', competitor: 'no' },
  { name: 'Multi-Platform', pushci: 'yes', competitor: 'GitHub only' },
  { name: 'Local Runs', pushci: 'yes', competitor: 'no' },
  { name: 'Auto-Detect Stack', pushci: 'yes', competitor: 'no' },
  { name: 'Deploy Targets', pushci: '16 built-in', competitor: 'Via marketplace' },
  { name: 'Vendor Lock-in', pushci: 'None', competitor: 'GitHub-only' },
]

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
  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <ComparisonHero
        title="PushCI vs GitHub Actions"
        subtitle="Stop writing YAML. Stop paying per minute. PushCI auto-detects your stack and runs CI locally for free."
        competitor="GitHub Actions"
      />
      <ComparisonTable features={features} competitorName="GitHub Actions" />
      <MigrationBlock beforeCode={beforeCode} beforeLabel="GitHub Actions YAML" />
      <Footer />
    </div>
  )
}
