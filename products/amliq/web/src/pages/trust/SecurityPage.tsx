import TrustPageHeader from './TrustPageHeader'
import TrustSection from './TrustSection'
import { securitySections } from './securityData'

export default function SecurityPage() {
  return (
    <div className="bg-token-bg min-h-screen">
      <TrustPageHeader
        title="Security"
        subtitle="How AMLIQ protects your data and operations"
      />
      <div className="max-w-4xl mx-auto px-4 pb-16 sm:pb-24">
        <div className="grid gap-6">
          {securitySections.map((section) => (
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
