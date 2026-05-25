import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { OwnershipGraph } from '../components/ubo/OwnershipGraph'
import type { UBONode, UBOEdge } from '../components/ubo/OwnershipGraph'

interface Owner {
  id: string
  owner_name: string
  nationality: string
  ownership_pct: number
  is_direct_owner: boolean
  is_pep: boolean
}

export function UBOChain() {
  const { t } = useTranslation('compliance')
  const { id } = useParams<{ id: string }>()
  const [owners, setOwners] = useState<Owner[]>([])
  const [totalPct, setTotalPct] = useState(0)

  useEffect(() => {
    if (!id) return
    api.get<{ owners: Owner[]; total_ownership_pct: number }>(`/ubo/${id}`)
      .then(d => {
        setOwners(d?.owners ?? [])
        setTotalPct(d?.total_ownership_pct ?? 0)
      })
      .catch(() => { setOwners([]); setTotalPct(0) })
  }, [id])

  // Build graph data: direct owners connect to the root entity node
  const rootNode: UBONode = { id: '__root__', label: id ?? 'Entity', ownershipPct: 100 }
  const graphNodes: UBONode[] = [
    rootNode,
    ...owners.map(o => ({ id: o.id, label: o.owner_name, ownershipPct: o.ownership_pct })),
  ]
  const graphEdges: UBOEdge[] = owners
    .filter(o => o.is_direct_owner)
    .map(o => ({ from: '__root__', to: o.id }))

  return (
    <div className="px-md py-lg sm:p-8 max-w-4xl mx-auto">
      <h1 className="sf-title sf-title mb-2">{t('ubo.title')}</h1>
      <p className="mb-6" style={{ color: 'var(--dash-text-secondary)' }}>
        {t('ubo.organization')} {id}
      </p>

      <div className="glass-card p-6 mb-4 rounded-apple-lg">
        <div className="flex justify-between items-center mb-4">
          <span className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>
            {t('ubo.total_identified')}
          </span>
          <span className="text-lg font-bold sf-title">{totalPct.toFixed(1)}%</span>
        </div>
        <div className="w-full rounded-full h-3 mb-6"
          style={{ background: 'var(--dash-surface)' }}>
          <div className="h-3 rounded-full bg-gradient-to-r from-[#C9A96E] to-indigo-600"
            style={{ width: `${Math.min(totalPct, 100)}%` }} />
        </div>

        {owners.length > 0 ? (
          <OwnershipGraph nodes={graphNodes} edges={graphEdges} />
        ) : (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--dash-text-secondary)' }}>
            No ownership data available
          </p>
        )}
      </div>
    </div>
  )
}
