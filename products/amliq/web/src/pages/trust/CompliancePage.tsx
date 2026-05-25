import TrustPageHeader from './TrustPageHeader'
import TrustSection from './TrustSection'
import { complianceSections } from './complianceData'

export default function CompliancePage() {
  return (
    <div className="bg-token-bg min-h-screen">
      <TrustPageHeader
        title="Compliance & Methodology"
        subtitle="How AMLIQ screens against global sanctions lists and produces auditable results"
      />
      <div className="max-w-4xl mx-auto px-4 pb-16 sm:pb-24">
        <div className="grid gap-6">
          {complianceSections.map((section) => (
            <TrustSection
              key={section.title}
              icon={section.icon}
              title={section.title}
              items={section.items}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
