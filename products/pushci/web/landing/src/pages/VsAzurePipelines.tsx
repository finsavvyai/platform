import { ComparisonHero } from '../components/ComparisonHero'
import { ComparisonTable } from '../components/ComparisonTable'
import { MigrationBlock } from '../components/MigrationBlock'
import { Footer } from '../components/Footer'
import { Navbar } from '../components/Navbar'
import { useDocumentMeta } from '../components/useDocumentMeta'

const features = [
  { name: 'Setup', pushci: 'npx pushci init', competitor: 'azure-pipelines.yml + agent setup' },
  { name: 'Configuration', pushci: 'Auto-detected', competitor: 'Manual YAML + tasks' },
  { name: 'Free tier', pushci: 'Unlimited local runs', competitor: '1 parallel job, 1800 min/mo (private)' },
  { name: 'Paid tier', pushci: '$0 forever', competitor: '$40/parallel job/month' },
  { name: 'AI Pipeline Gen', pushci: 'yes', competitor: 'no' },
  { name: 'Multi-Cloud Deploy', pushci: '22 built-in targets', competitor: 'Azure-first' },
  { name: 'Local Runs', pushci: 'yes', competitor: 'Self-hosted agents only' },
  { name: 'Auto-Detect Stack', pushci: 'yes', competitor: 'no' },
  { name: 'Identity', pushci: 'GitHub/GitLab/Google OAuth', competitor: 'Entra ID / Microsoft account' },
  { name: 'Vendor Lock-in', pushci: 'None', competitor: 'Azure DevOps + MS ecosystem' },
]

const azureNote = `Azure Pipelines bundles a free parallel job and 1,800 minutes per month for private repos, then charges $40 per additional parallel job. Public repos get 10 free jobs — but you only see that pricing buried in the Microsoft Commerce portal. Most teams discover they need self-hosted agents three weeks in, which is when the YAML grows into a 400-line tower of tasks, variables, and template references. PushCI never grows YAML, because there is no YAML.`

const beforeCode = `# azure-pipelines.yml
trigger:
  - main
pool:
  vmImage: ubuntu-latest
steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'
  - script: npm ci
    displayName: 'Install'
  - script: npm test
    displayName: 'Test'
  - script: npm run build
    displayName: 'Build'`

export default function VsAzurePipelines() {
  useDocumentMeta({
    title: 'PushCI vs Azure Pipelines — Escape the Microsoft Tax',
    description: 'Compare PushCI vs Azure Pipelines. PushCI replaces parallel-job pricing and Entra ID lock-in with free local CI. AI auto-detects your stack. No YAML.',
    canonical: 'https://pushci.dev/vs/azure-pipelines',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'PushCI vs Azure Pipelines',
      description: 'Detailed comparison between PushCI and Azure Pipelines CI/CD platforms',
      url: 'https://pushci.dev/vs/azure-pipelines',
    },
  })
  return (
    <div className="min-h-screen bg-root">
      <Navbar />
      <ComparisonHero
        title="PushCI vs Azure Pipelines"
        subtitle="Stop paying $40 a month for a parallel job. PushCI runs every job in parallel on your machine for free."
        competitor="Azure Pipelines"
      />
      <ComparisonTable features={features} competitorName="Azure Pipelines" />
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 p-5">
          <p className="text-sm font-semibold text-sky-400 mb-1">Microsoft ecosystem reality</p>
          <p className="text-sm text-gray-300">{azureNote}</p>
        </div>
      </div>
      <MigrationBlock beforeCode={beforeCode} beforeLabel="azure-pipelines.yml" />
      <Footer />
    </div>
  )
}
