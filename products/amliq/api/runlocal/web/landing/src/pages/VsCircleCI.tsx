import { ComparisonHero } from '../components/ComparisonHero'
import { ComparisonTable } from '../components/ComparisonTable'
import { MigrationBlock } from '../components/MigrationBlock'
import { Footer } from '../components/Footer'
import { Navbar } from '../components/Navbar'

const features = [
  { name: 'Setup', pushci: 'npx pushci init', competitor: '.circleci/config.yml' },
  { name: 'Configuration', pushci: 'Auto-detected', competitor: 'Manual YAML + Orbs' },
  { name: 'Cost', pushci: 'Free forever', competitor: '$15/mo+ (credit-based)' },
  { name: 'AI Pipeline Gen', pushci: 'yes', competitor: 'no' },
  { name: 'Multi-Platform', pushci: 'yes', competitor: 'GitHub/Bitbucket only' },
  { name: 'Local Runs', pushci: 'yes', competitor: 'circleci local (limited)' },
  { name: 'Auto-Detect Stack', pushci: 'yes', competitor: 'no' },
  { name: 'Deploy Targets', pushci: '16 built-in', competitor: 'Orbs marketplace' },
  { name: 'Vendor Lock-in', pushci: 'None', competitor: 'CircleCI config format' },
]

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
  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <ComparisonHero
        title="PushCI vs CircleCI"
        subtitle="Stop burning credits. PushCI gives you zero-config CI that runs locally and costs nothing."
        competitor="CircleCI"
      />
      <ComparisonTable features={features} competitorName="CircleCI" />
      <MigrationBlock beforeCode={beforeCode} beforeLabel="CircleCI YAML" />
      <Footer />
    </div>
  )
}
