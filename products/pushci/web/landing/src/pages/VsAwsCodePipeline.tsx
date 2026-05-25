import { ComparisonHero } from '../components/ComparisonHero'
import { ComparisonTable } from '../components/ComparisonTable'
import { MigrationBlock } from '../components/MigrationBlock'
import { Footer } from '../components/Footer'
import { Navbar } from '../components/Navbar'
import { useDocumentMeta } from '../components/useDocumentMeta'

const features = [
  { name: 'Setup', pushci: 'npx pushci init', competitor: 'CloudFormation / CDK / Console clicks' },
  { name: 'Configuration', pushci: 'Auto-detected', competitor: 'JSON + IAM + CodeBuild buildspec' },
  { name: 'Pricing', pushci: '$0 forever', competitor: '$1/active pipeline/month + CodeBuild compute' },
  { name: 'Hidden cost', pushci: 'None', competitor: 'S3 artifacts, CloudWatch logs, NAT gateway' },
  { name: 'AI Pipeline Gen', pushci: 'yes', competitor: 'no' },
  { name: 'Multi-Cloud Deploy', pushci: '22 built-in targets', competitor: 'AWS-only without custom actions' },
  { name: 'Local Runs', pushci: 'yes', competitor: 'no (CodeBuild local agent is read-only)' },
  { name: 'Auto-Detect Stack', pushci: 'yes', competitor: 'no' },
  { name: 'Identity', pushci: 'GitHub/GitLab/Google OAuth', competitor: 'IAM + AssumeRole gymnastics' },
  { name: 'Vendor Lock-in', pushci: 'None', competitor: 'AWS account-wide' },
]

const awsNote = `AWS CodePipeline is technically $1 per active pipeline per month. That's the part the calculator shows. What it does not show: CodeBuild compute time, S3 storage for artifacts, CloudWatch log retention, data egress, KMS key usage, and the half-day every new hire spends getting CodeStarConnections to talk to GitHub. The "$1" pipeline routinely settles at $40–$200/month per environment once it has run for a quarter. PushCI runs the build on the same hardware where the developer is already paying for electricity.`

const beforeCode = `# buildspec.yml (CodeBuild side of a CodePipeline)
version: 0.2
phases:
  install:
    runtime-versions:
      nodejs: 20
    commands:
      - npm ci
  build:
    commands:
      - npm test
      - npm run build
artifacts:
  files:
    - dist/**/*`

export default function VsAwsCodePipeline() {
  useDocumentMeta({
    title: 'PushCI vs AWS CodePipeline — End the Per-Action Tax',
    description: 'Compare PushCI vs AWS CodePipeline. PushCI replaces per-pipeline + per-action billing and IAM gymnastics with free local CI. AI auto-detects your stack.',
    canonical: 'https://pushci.dev/vs/aws-codepipeline',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'PushCI vs AWS CodePipeline',
      description: 'Detailed comparison between PushCI and AWS CodePipeline CI/CD platforms',
      url: 'https://pushci.dev/vs/aws-codepipeline',
    },
  })
  return (
    <div className="min-h-screen bg-root">
      <Navbar />
      <ComparisonHero
        title="PushCI vs AWS CodePipeline"
        subtitle="Stop paying $1 a pipeline plus CodeBuild compute plus S3 plus CloudWatch. PushCI runs locally for $0."
        competitor="AWS CodePipeline"
      />
      <ComparisonTable features={features} competitorName="AWS CodePipeline" />
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-5">
          <p className="text-sm font-semibold text-orange-400 mb-1">The "$1" lie</p>
          <p className="text-sm text-gray-300">{awsNote}</p>
        </div>
      </div>
      <MigrationBlock beforeCode={beforeCode} beforeLabel="buildspec.yml" />
      <Footer />
    </div>
  )
}
