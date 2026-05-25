import { ComparisonHero } from '../components/ComparisonHero'
import { ComparisonTable } from '../components/ComparisonTable'
import { MigrationBlock } from '../components/MigrationBlock'
import { Footer } from '../components/Footer'
import { Navbar } from '../components/Navbar'
import { useDocumentMeta } from '../components/useDocumentMeta'

const features = [
  { name: 'Setup', pushci: 'npx pushci init', competitor: '.circleci/config.yml' },
  { name: 'Configuration', pushci: 'Auto-detected', competitor: 'Manual YAML + Orbs' },
  { name: 'Cost', pushci: 'Free forever', competitor: '$15/mo+ (6,000 credits free tier)' },
  { name: 'AI Pipeline Gen', pushci: 'yes', competitor: 'no' },
  { name: 'Multi-Platform', pushci: 'yes', competitor: 'GitHub/Bitbucket only' },
  { name: 'Local Runs', pushci: 'yes', competitor: 'circleci local (limited)' },
  { name: 'Auto-Detect Stack', pushci: 'yes', competitor: 'no' },
  { name: 'Deploy Targets', pushci: '16 built-in', competitor: 'Orbs marketplace' },
  { name: 'Security track record', pushci: 'Audited', competitor: 'Breached Dec 2022' },
  { name: 'Vendor Lock-in', pushci: 'None', competitor: 'CircleCI config format' },
]

const circleCINote = `In December 2022, CircleCI suffered a major security breach — customer secrets stored in CI were compromised. They asked every user to rotate all secrets immediately. Their free tier is 6,000 credits/month, which sounds generous until you realize a 10-minute Docker build costs ~4,000 credits.`

const beforeCode = `# .circleci/config.yml
version: 2.1
jobs:
  build:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - run: npm ci
      - run: npm test
      - run: npm run build
workflows:
  main:
    jobs:
      - build`

export default function VsCircleCI() {
  useDocumentMeta({
    title: 'PushCI vs CircleCI — Stop Burning CI Credits',
    description: 'Compare PushCI vs CircleCI. PushCI replaces credit-based pricing with free local CI/CD. AI auto-detects your stack. No YAML, no cloud bills.',
    canonical: 'https://pushci.dev/vs/circleci',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'PushCI vs CircleCI',
      description: 'Detailed comparison between PushCI and CircleCI CI/CD platforms',
      url: 'https://pushci.dev/vs/circleci',
    },
  })
  return (
    <div className="min-h-screen bg-root">
      <Navbar />
      <ComparisonHero
        title="PushCI vs CircleCI"
        subtitle="Stop burning credits. PushCI gives you zero-config CI that runs locally and costs nothing."
        competitor="CircleCI"
      />
      <ComparisonTable features={features} competitorName="CircleCI" />
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-5">
          <p className="text-sm font-semibold text-red-400 mb-1">Security & cost reality check</p>
          <p className="text-sm text-gray-300">{circleCINote}</p>
        </div>
      </div>
      <MigrationBlock beforeCode={beforeCode} beforeLabel="CircleCI YAML" />
      <Footer />
    </div>
  )
}
