import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { UserActivity } from '@/types/user-management'
import { Activity, Clock, Globe, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'

interface UserActivityTimelineProps {
  activities: UserActivity[]
  loading?: boolean
}

const statusVariant: Record<string, React.ComponentProps<typeof Badge>['variant']> = {
  success: 'success',
  info: 'info',
  warning: 'warning',
  error: 'destructive',
}

export function UserActivityTimeline({ activities, loading }: UserActivityTimelineProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Recent activity
        </CardTitle>
        <CardDescription>
          Track key actions performed by this user across the platform.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="rounded-md border border-dashed border-muted-foreground/30 p-6 text-center text-sm text-muted-foreground">
            No activity recorded for this user yet.
          </div>
        ) : (
          <ol className="space-y-4">
            {activities.map((activity) => {
              const timestamp = activity.createdAt
              const date = typeof timestamp === 'string' ? parseISO(timestamp) : new Date(timestamp)
              const status = activity.success
                ? 'success'
                : activity.errorMessage
                ? 'error'
                : 'info'
              const description =
                (typeof activity.metadata?.description === 'string'
                  ? activity.metadata.description
                  : undefined) ||
                activity.resource ||
                activity.action.replace(/_/g, ' ')
              const policy =
                typeof activity.metadata?.policy === 'string'
                  ? activity.metadata.policy
                  : undefined
              return (
                <li key={activity.id} className="relative rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">
                        {activity.action.replace(/_/g, ' ')}
                      </h4>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                    <Badge variant={statusVariant[status] ?? 'info'}>
                      {status}
                    </Badge>
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{formatDistanceToNow(date, { addSuffix: true })}</span>
                    </div>
                    {activity.ipAddress && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5" />
                        <span>{activity.ipAddress}</span>
                      </div>
                    )}
                    {policy && (
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        <span>{policy}</span>
                      </div>
                    )}
                  </dl>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
