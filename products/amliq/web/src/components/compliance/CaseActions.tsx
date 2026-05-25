import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'

interface Props {
  caseId: string
  status: string
  validTransitions: string[]
  onAction: () => void
}

const statusColors: Record<string, string> = {
  in_review: 'bg-[#1A1814]',
  escalated: 'bg-apple-orange',
  pending_info: 'bg-apple-yellow text-black',
  resolved: 'bg-apple-green',
  false_positive: 'bg-apple-green',
  true_match: 'bg-apple-red',
  closed: 'bg-apple-bg-tertiary text-apple-label-secondary',
}

export function CaseActions({ caseId, status, validTransitions, onAction }: Props) {
  const { t } = useTranslation('compliance')
  const [comment, setComment] = useState('')
  const [assignee, setAssignee] = useState('')

  const handleTransition = async (toStatus: string) => {
    await api.put(`/cases/${caseId}/transition`, { to_status: toStatus, comment })
    setComment('')
    onAction()
  }

  const handleAssign = async () => {
    if (!assignee) return
    await api.put(`/cases/${caseId}/assign`, { user_id: assignee })
    setAssignee('')
    onAction()
  }

  return (
    <div className="mb-8">
      <div className="flex gap-2 mb-4 flex-wrap">
        {validTransitions.map(s => (
          <button key={s} onClick={() => handleTransition(s)}
            aria-label={`Transition to ${s}`}
            className={`px-4 py-2 text-white rounded-apple-md text-sm cursor-pointer
              transition-colors hover:opacity-80 focus-visible:outline-2
              focus-visible:outline-offset-2 focus-visible:outline-[#C9A96E]
              ${statusColors[s] || 'bg-[#1A1814]'}`}>
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-4">
        <input value={comment} onChange={e => setComment(e.target.value)}
          placeholder={t('case_detail.add_comment')}
          className="flex-1 px-3 py-2 rounded-apple-md text-sm focus:outline-[#C9A96E]"
          style={{ background: 'var(--dash-bg-secondary)', border: '0.5px solid var(--dash-border)', color: 'var(--dash-text)' }} />
      </div>
      <div className="flex gap-2">
        <input value={assignee} onChange={e => setAssignee(e.target.value)}
          placeholder={t('case_detail.assign_to')}
          className="px-3 py-2 rounded-apple-md text-sm focus:outline-[#C9A96E]"
          style={{ background: 'var(--dash-bg-secondary)', border: '0.5px solid var(--dash-border)', color: 'var(--dash-text)' }} />
        <button onClick={handleAssign}
          aria-label={t('case_detail.assign')}
          className="px-4 py-2 bg-[#1A1814] text-white rounded-apple-md text-sm
            cursor-pointer hover:opacity-80">
          {t('case_detail.assign')}
        </button>
      </div>
    </div>
  )
}
