import { ComparisonHero } from '../components/ComparisonHero'
import { ComparisonTable } from '../components/ComparisonTable'
import { MigrationBlock } from '../components/MigrationBlock'
import { Footer } from '../components/Footer'
import { Navbar } from '../components/Navbar'
import { useDocumentMeta } from '../components/useDocumentMeta'

const features = [
  { name: 'Setup', pushci: '30 seconds', competitor: 'Hours (server + plugins)' },
  { name: 'Configuration', pushci: 'AI auto-detected', competitor: 'Jenkinsfile + Groovy' },
  { name: 'Cost', pushci: 'Free forever', competitor: 'Server hosting + maintenance' },
  { name: 'AI Pipeline Gen', pushci: 'yes', competitor: 'no' },
  { name: 'Cloud-native', pushci: 'yes', competitor: 'no' },
  { name: 'Infrastructure', pushci: 'None (runs locally)', competitor: 'Dedicated server required' },
  { name: 'Maintenance', pushci: 'Zero', competitor: 'Plugin updates, security patches' },
  { name: 'Auto-Detect Stack', pushci: 'yes', competitor: 'no' },
  { name: 'Deploy Targets', pushci: '16 built-in', competitor: 'Plugin-dependent' },
  { name: 'Learning Curve', pushci: 'None', competitor: 'Groovy DSL + admin skills' },
]

const jenkinsNote = `Jenkins holds 44% market share by install count — but the industry has started calling it "legacy." No AI story. No cloud-native features. Still requires a dedicated Jenkins admin who knows Groovy, understands plugin compatibility matrices, and isn't planning to leave. When that person leaves, you'll understand why teams are migrating.`

const beforeCode = `// Jenkinsfile
pipeline {
    agent any
    stages {
        stage('Install') {
            steps {
                sh 'npm ci'
            }
        }
        stage('Test') {
            steps {
                sh 'npm test'
            }
        }
        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }
    }
}`

export default function VsJenkins() {
  useDocumentMeta({
    title: 'PushCI vs Jenkins — No Servers, No Plugins, No Groovy',
    description: 'Compare PushCI vs Jenkins. Replace Jenkins server maintenance and Groovy DSL with AI-powered zero-config CI/CD that runs locally for free.',
    canonical: 'https://pushci.dev/vs/jenkins',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'PushCI vs Jenkins',
      description: 'Detailed comparison between PushCI and Jenkins CI/CD platforms',
      url: 'https://pushci.dev/vs/jenkins',
    },
  })
  return (
    <div className="min-h-screen bg-root">
      <Navbar />
      <ComparisonHero
        title="PushCI vs Jenkins"
        subtitle="No more Jenkins servers. No more plugin hell. PushCI gives you AI-powered CI/CD with zero infrastructure."
        competitor="Jenkins"
      />
      <ComparisonTable features={features} competitorName="Jenkins" />
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="rounded-lg border border-gray-500/40 bg-gray-500/10 p-5">
          <p className="text-sm font-semibold text-gray-300 mb-1">The Jenkins reality in 2026</p>
          <p className="text-sm text-gray-400">{jenkinsNote}</p>
        </div>
      </div>
      <MigrationBlock beforeCode={beforeCode} beforeLabel="Jenkinsfile (Groovy)" />
      <Footer />
    </div>
  )
}
