import HeroSection from './HeroSection'
import TrustStrip from './TrustStrip'
import ProblemSection from './ProblemSection'
import SolutionSection from './SolutionSection'
import WorkflowSection from './WorkflowSection'
import EngineSection from './EngineSection'
import FeaturesGrid from './FeaturesGrid'
import UseCasesSection from './UseCasesSection'
import MetricsSection from './MetricsSection'
import ComparisonTable from './ComparisonTable'
import PricingSection from './PricingSection'
import SecurityTeaser from './SecurityTeaser'
import FAQSection from './FAQSection'
import CTASection from './CTASection'
import FAQSchema from './FAQSchema'

export default function LandingPage() {
  return (
    <div className="scroll-smooth" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <HeroSection />
      <TrustStrip />
      <ProblemSection />
      <SolutionSection />
      <WorkflowSection />
      <EngineSection />
      <FeaturesGrid />
      <UseCasesSection />
      <MetricsSection />
      <ComparisonTable />
      <PricingSection />
      <SecurityTeaser />
      <FAQSection />
      <CTASection />
      <FAQSchema />
    </div>
  )
}
