import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  change?: {
    value: number
    type: 'increase' | 'decrease' | 'neutral'
    period: string
  }
  description?: string
  icon?: React.ReactNode
  loading?: boolean
  className?: string
  trendValue?: string
  format?: 'number' | 'currency' | 'percentage'
}

export function StatsCard({
  title,
  value,
  change,
  description,
  icon,
  loading = false,
  className,
  trendValue,
  format = 'number',
}: StatsCardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(val)
      case 'percentage':
        return `${val}%`
      default:
        return new Intl.NumberFormat('en-US').format(val)
    }
  }

  const getTrendIcon = () => {
    switch (change?.type) {
      case 'increase':
        return <TrendingUp className="h-3 w-3" />
      case 'decrease':
        return <TrendingDown className="h-3 w-3" />
      default:
        return <Minus className="h-3 w-3" />
    }
  }

  const getTrendColor = () => {
    switch (change?.type) {
      case 'increase':
        return 'text-green-600 dark:text-green-400'
      case 'decrease':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-muted-foreground'
    }
  }

  if (loading) {
    return (
      <Card className={cn('relative overflow-hidden', className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-4 rounded" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24 mb-1" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatValue(value)}</div>
        {(change || description) && (
          <div className="flex items-center space-x-2 text-xs">
            {change && (
              <div className={cn('flex items-center', getTrendColor())}>
                {getTrendIcon()}
                <span className="ml-1">
                  {trendValue || `${Math.abs(change.value)}%`}
                </span>
                <span className="ml-1 text-muted-foreground">
                  {change.period}
                </span>
              </div>
            )}
            {description && !change && (
              <p className="text-muted-foreground">{description}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Grid component for displaying multiple stats cards
export function StatsGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {children}
    </div>
  )
}

// Quick stats variant for dashboard overview
export function QuickStats({
  stats,
  loading = false,
}: {
  stats: Omit<StatsCardProps, 'loading'>[]
  loading?: boolean
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <StatsCard key={index} {...stat} loading={loading} />
      ))}
    </div>
  )
}

// Example usage:
// <QuickStats
//   stats={[
//     {
//       title: 'Total Users',
//       value: 12543,
//       change: {
//         value: 12,
//         type: 'increase',
//         period: 'from last month'
//       },
//       icon: <Users className="h-4 w-4" />,
//       format: 'number'
//     },
//     {
//       title: 'Revenue',
//       value: 45678,
//       change: {
//         value: 8,
//         type: 'increase',
//         period: 'from last month'
//       },
//       icon: <DollarSign className="h-4 w-4" />,
//       format: 'currency'
//     },
//   ]}
// />
