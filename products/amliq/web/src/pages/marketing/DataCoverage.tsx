import { FadeIn, StaggerGroup } from './animations'
import { dataSources } from './DataCoverageData'
import SourceCard from './DataCoverageCard'

export default function DataCoverage() {
  const totalRecords = dataSources.reduce((sum, s) => sum + s.recordCount, 0)
  const activeSources = dataSources.filter((s) => s.status === 'active').length

  return (
    <section className="py-20 sm:py-28 px-4">
      <div className="max-w-[1280px] mx-auto">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="text-sm font-semibold tracking-widest uppercase text-token-gold mb-4">GLOBAL COVERAGE</p>
            <h2 className="text-32 sm:text-48 font-bold text-slate-900">
              Enterprise Data Depth
            </h2>
            <p className="text-17 mt-4 max-w-[640px] mx-auto text-slate-600">
              Access 7 comprehensive data sources covering 195 countries with 6M+ records.
              Updated daily from official government and intelligence sources.
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12 px-4 sm:px-0">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
              <p className="text-13 text-slate-600">Total Records</p>
              <p className="text-28 font-bold mt-2"
                style={{ background: 'linear-gradient(135deg, var(--accent-gold), var(--accent-gold))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {(totalRecords / 1000000).toFixed(1)}M+
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
              <p className="text-13 text-slate-600">Active Sources</p>
              <p className="text-28 font-bold mt-2"
                style={{ background: 'linear-gradient(135deg, var(--accent-gold), var(--accent-gold))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {activeSources}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
              <p className="text-13 text-slate-600">Countries Covered</p>
              <p className="text-28 font-bold mt-2"
                style={{ background: 'linear-gradient(135deg, var(--accent-gold), var(--accent-gold))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                195
              </p>
            </div>
          </div>
        </FadeIn>
        <StaggerGroup>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dataSources.map((source) => (
              <SourceCard key={source.id} source={source} />
            ))}
          </div>
        </StaggerGroup>
      </div>
    </section>
  )
}
