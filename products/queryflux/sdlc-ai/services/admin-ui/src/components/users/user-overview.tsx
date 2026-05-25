import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatsCard } from '@/components/ui/stats-card'
import type { UserStatsResponse } from '@/types/user-management'
import { ShieldCheck, Users, UserCog, UserX } from 'lucide-react'

interface UserOverviewProps {
  stats: UserStatsResponse | null
  loading?: boolean
}

export function UserOverview({ stats, loading }: UserOverviewProps) {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Users className="h-5 w-5 text-primary" />
          User overview
        </CardTitle>
        <CardDescription>
          Monitor user growth, engagement, and compliance at a glance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total users"
            value={stats?.totals.users ?? 0}
            loading={loading}
            icon={<Users className="h-4 w-4" />}
            change={
              stats
                ? {
                    value: stats.growth.percentage,
                    type: stats.growth.percentage >= 0 ? 'increase' : 'decrease',
                    period: stats.growth.timeframe === '7d' ? 'vs last week' : 'vs last period',
                  }
                : undefined
            }
          />
          <StatsCard
            title="Active users"
            value={stats?.totals.activeUsers ?? 0}
            loading={loading}
            icon={<ShieldCheck className="h-4 w-4" />}
            description="Users with activity in the last 30 days"
          />
          <StatsCard
            title="Suspended"
            value={stats?.totals.suspendedUsers ?? 0}
            loading={loading}
            icon={<UserX className="h-4 w-4" />}
            description="Currently suspended accounts"
          />
          <StatsCard
            title="Pending invites"
            value={stats?.totals.pendingInvites ?? 0}
            loading={loading}
            icon={<UserCog className="h-4 w-4" />}
            description="Awaiting user onboarding"
          />
        </div>
      </CardContent>
    </Card>
  )
}
