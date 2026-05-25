import { ComparisonHero } from '../components/ComparisonHero'
import { ComparisonTable } from '../components/ComparisonTable'
import { MigrationBlock } from '../components/MigrationBlock'
import { Footer } from '../components/Footer'
import { Navbar } from '../components/Navbar'
import { useDocumentMeta } from '../components/useDocumentMeta'

const features = [
  { name: 'Setup', pushci: 'npx pushci init', competitor: 'bitbucket-pipelines.yml' },
  { name: 'Configuration', pushci: 'Auto-detected', competitor: 'Manual YAML' },
  { name: 'Free tier', pushci: 'Unlimited local runs', competitor: '50 build min/month' },
  { name: 'Paid tier', pushci: '$0 forever', competitor: '$10/user/mo for 2,500 min' },
  { name: 'AI Pipeline Gen', pushci: 'yes', competitor: 'no' },
  { name: 'Multi-Repo Host', pushci: 'Any git remote', competitor: 'Bitbucket only' },
  { name: 'Local Runs', pushci: 'yes', competitor: 'no' },
  { name: 'Auto-Detect Stack', pushci: 'yes', competitor: 'no' },
  { name: 'Deploy Targets', pushci: '22 built-in', competitor: 'Pipes marketplace' },
  { name: 'Vendor Lock-in', pushci: 'None', competitor: 'Bitbucket + Atlassian' },
]

const bitbucketNote = `Bitbucket Pipelines bills by the build minute. The free tier is 50 minutes per month — a single 5-minute Node build that runs ten times a day burns it on day one. Paid plans bundle 2,500 minutes for $10/user/month, but the meter never stops while your container sits idle waiting for a "needs" gate. PushCI runs the same job on your laptop. Zero minutes consumed.`

const beforeCode = `# bitbucket-pipelines.yml
image: node:20
pipelines:
  default:
    - step:
        name: Build & Test
        caches:
          - node
        script:
          - npm ci
          - npm test
          - npm run build`

export default function VsBitbucketPipelines() {
  useDocumentMeta({
    title: 'PushCI vs Bitbucket Pipelines — Skip the Build-Minute Meter',
    description: 'Compare PushCI vs Bitbucket Pipelines. PushCI replaces per-minute billing with free local CI. AI auto-detects your stack. No YAML, no Atlassian lock-in.',
    canonical: 'https://pushci.dev/vs/bitbucket-pipelines',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'PushCI vs Bitbucket Pipelines',
      description: 'Detailed comparison between PushCI and Bitbucket Pipelines CI/CD platforms',
      url: 'https://pushci.dev/vs/bitbucket-pipelines',
    },
  })
  return (
    <div className="min-h-screen bg-root">
      <Navbar />
      <ComparisonHero
        title="PushCI vs Bitbucket Pipelines"
        subtitle="Stop renting build minutes from Atlassian. PushCI runs on your laptop for free."
        competitor="Bitbucket Pipelines"
      />
      <ComparisonTable features={features} competitorName="Bitbucket Pipelines" />
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-5">
          <p className="text-sm font-semibold text-amber-400 mb-1">Build-minute math</p>
          <p className="text-sm text-gray-300">{bitbucketNote}</p>
        </div>
      </div>
      <MigrationBlock beforeCode={beforeCode} beforeLabel="bitbucket-pipelines.yml" />
      <Footer />
    </div>
  )
}
