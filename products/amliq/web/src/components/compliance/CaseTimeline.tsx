import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'

interface TimelineEvent {
  id: number
  event_type: string
  actor: string
  details: string
  created_at: string
}

interface Comment {
  id: string
  content: string
  created_at: string
}

interface Props {
  caseId: string
  comments: Comment[]
}

export function CaseTimeline({ caseId, comments }: Props) {
  const { t } = useTranslation('compliance')
  const [events, setEvents] = useState<TimelineEvent[]>([])

  useEffect(() => {
    api.get<{ events: TimelineEvent[] }>(`/cases/${caseId}/timeline`)
      .then(d => setEvents(d?.events ?? []))
      .catch(() => setEvents([]))
  }, [caseId])

  const allItems = [
    ...events.map(e => ({ type: 'event' as const, time: e.created_at, data: e })),
    ...comments.map(c => ({ type: 'comment' as const, time: c.created_at, data: c })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  return (
    <div className="mt-8">
      <h2 className="text-lg font-medium mb-4">{t('case_detail.timeline')}</h2>
      <div className="space-y-3">
        {allItems.map((item, i) => (
          <div key={i} className="border-l-2 border-[#C9A96E]/30 pl-4 py-2">
            {item.type === 'event' ? (
              <div>
                <span className="text-xs font-medium text-[#C9A96E]">{item.data.event_type}</span>
                <p className="text-sm">{(item.data as TimelineEvent).details}</p>
                <p className="text-xs text-apple-label-tertiary">
                  {(item.data as TimelineEvent).actor} - {item.time}
                </p>
              </div>
            ) : (
              <div>
                <span className="text-xs font-medium text-apple-green">Comment</span>
                <p className="text-sm">{(item.data as Comment).content}</p>
                <p className="text-xs text-apple-label-tertiary">{item.time}</p>
              </div>
            )}
          </div>
        ))}
        {allItems.length === 0 && (
          <p className="text-apple-label-secondary text-sm">{t('case_detail.no_activity')}</p>
        )}
      </div>
    </div>
  )
}
