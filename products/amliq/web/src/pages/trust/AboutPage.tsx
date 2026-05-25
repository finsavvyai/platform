import TrustPageHeader from './TrustPageHeader'
import TrustSection from './TrustSection'
import { aboutSections } from './aboutData'

export default function AboutPage() {
  return (
    <div className="bg-token-bg min-h-screen">
      <TrustPageHeader
        title="About AMLIQ"
        subtitle="We build sanctions screening infrastructure that financial institutions can trust."
      />
      <div className="max-w-4xl mx-auto px-4 pb-16 sm:pb-24">
        <div className="grid gap-6">
          {aboutSections.map((section) => (
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
