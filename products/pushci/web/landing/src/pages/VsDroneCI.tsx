import { ComparisonHero } from '../components/ComparisonHero'
import { ComparisonTable } from '../components/ComparisonTable'
import { MigrationBlock } from '../components/MigrationBlock'
import { Footer } from '../components/Footer'
import { Navbar } from '../components/Navbar'
import { useDocumentMeta } from '../components/useDocumentMeta'

const features = [
  { name: 'Setup', pushci: '30 seconds', competitor: 'Docker + server setup' },
  { name: 'Configuration', pushci: 'AI auto-detected', competitor: '.drone.yml + Docker' },
  { name: 'Cost', pushci: 'Free forever', competitor: 'Free OSS / $499/yr enterprise' },
  { name: 'AI Pipeline Gen', pushci: 'yes', competitor: 'no' },
  { name: 'Docker Required', pushci: 'No', competitor: 'Yes (core dependency)' },
  { name: 'Local Runs', pushci: 'yes', competitor: 'drone exec (limited)' },
  { name: 'Auto-Detect Stack', pushci: 'yes', competitor: 'no' },
  { name: 'Deploy Targets', pushci: '16 built-in', competitor: 'Plugin-based' },
  { name: 'Active Development', pushci: 'Yes', competitor: 'Acquired by Harness (2022)' },
]

const beforeCode = `# .drone.yml
kind: pipeline
type: docker
name: default

steps:
  - name: install
    image: node:20
    commands:
      - npm ci
  - name: test
    image: node:20
    commands:
      - npm test
  - name: build
    image: node:20
    commands:
      - npm run build`

export default function VsDroneCI() {
  useDocumentMeta({
    title: 'PushCI vs Drone CI — Independent AI-Native CI/CD',
    description: 'Compare PushCI vs Drone CI. Drone was acquired by Harness. PushCI is independent, AI-native, and runs without Docker. Free forever.',
    canonical: 'https://pushci.dev/vs/drone-ci',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'PushCI vs Drone CI',
      description: 'Detailed comparison between PushCI and Drone CI platforms',
      url: 'https://pushci.dev/vs/drone-ci',
    },
  })
  return (
    <div className="min-h-screen bg-root">
      <Navbar />
      <ComparisonHero
        title="PushCI vs Drone CI"
        subtitle="Drone was acquired by Harness. PushCI is independent, AI-native, and doesn't need Docker to run your tests."
        competitor="Drone CI"
      />
      <ComparisonTable features={features} competitorName="Drone CI" />
      <MigrationBlock beforeCode={beforeCode} beforeLabel="Drone CI YAML" />
      <Footer />
    </div>
  )
}
