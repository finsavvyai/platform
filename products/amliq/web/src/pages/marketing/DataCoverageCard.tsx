import { motion } from 'framer-motion'
import { staggerChild } from './animations'
import type { DataSource } from './DataCoverageData'
import { statusColors, statusLabels } from './DataCoverageData'

export default function SourceCard({ source }: { source: DataSource }) {
  const statusColor = statusColors[source.status]
  const statusLabel = statusLabels[source.status]

  return (
    <motion.div variants={staggerChild}
      className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-15 font-semibold text-slate-900">{source.name}</h3>
          <p className="text-13 mt-1 text-slate-600">{source.category}</p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-11 font-medium"
          style={{ background: `${statusColor}20`, color: statusColor }}>
          {statusLabel}
        </span>
      </div>
      <div className="space-y-3 border-t border-slate-200 pt-4">
        <div className="flex justify-between items-center">
          <span className="text-13 text-slate-600">Records</span>
          <span className="text-14 font-semibold text-slate-900">
            {source.recordCount.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-13 text-slate-600">Coverage</span>
          <span className="text-14 font-semibold text-slate-900">
            {source.coverageCountries} countries
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-13 text-slate-600">Last Updated</span>
          <span className="text-13 font-medium text-slate-900">
            {new Date(source.lastUpdated).toLocaleDateString()}
          </span>
        </div>
      </div>
    </motion.div>
  )
}
