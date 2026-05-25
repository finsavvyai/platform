import { ComparisonHero } from '../components/ComparisonHero'
import { ComparisonTable } from '../components/ComparisonTable'
import { MigrationBlock } from '../components/MigrationBlock'
import { Footer } from '../components/Footer'
import { Navbar } from '../components/Navbar'

const features = [
  { name: 'Setup', pushci: 'npx pushci init', competitor: '.gitlab-ci.yml' },
  { name: 'Configuration', pushci: 'Auto-detected', competitor: 'Manual YAML' },
  { name: 'Cost', pushci: 'Free forever', competitor: '400 min/mo free, then paid' },
  { name: 'AI Pipeline Gen', pushci: 'yes', competitor: 'no' },
  { name: 'Multi-Platform', pushci: 'yes', competitor: 'GitLab only' },
  { name: 'Local Runs', pushci: 'yes', competitor: 'Limited (gitlab-runner)' },
  { name: 'Auto-Detect Stack', pushci: 'yes', competitor: 'Auto DevOps (limited)' },
  { name: 'Deploy Targets', pushci: '16 built-in', competitor: 'Manual config' },
  { name: 'Vendor Lock-in', pushci: 'None', competitor: 'GitLab-only' },
]

const beforeCode = `# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy
test:
  stage: test
  image: node:20
  script:
    - npm ci
    - npm test
build:
  stage: build
  script:
    - npm run build`

export default function VsGitLabCI() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <ComparisonHero
        title="PushCI vs GitLab CI"
        subtitle="Escape GitLab lock-in. PushCI works with any Git platform and runs CI on your machine for free."
        competitor="GitLab CI"
      />
      <ComparisonTable features={features} competitorName="GitLab CI" />
      <MigrationBlock beforeCode={beforeCode} beforeLabel="GitLab CI YAML" />
      <Footer />
    </div>
  )
}
