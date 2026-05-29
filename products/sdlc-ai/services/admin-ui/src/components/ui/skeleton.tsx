import { cn } from '@/lib/utils'

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  )
}

// Table skeleton
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex space-x-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              className={cn(
                'h-4',
                colIndex === 0 && 'w-[100px]',
                colIndex === 1 && 'w-[200px]',
                colIndex === 2 && 'w-[150px]',
                colIndex === 3 && 'w-[100px]'
              )}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// Card skeleton
export function CardSkeleton({
  hasHeader = true,
  lines = 3,
  className,
}: {
  hasHeader?: boolean
  lines?: number
  className?: string
}) {
  return (
    <div className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)}>
      {hasHeader && (
        <div className="flex flex-col space-y-1.5 p-6">
          <Skeleton className="h-5 w-1/3" />
        </div>
      )}
      <div className="p-6 pt-0">
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, index) => (
            <Skeleton
              key={index}
              className={cn(
                'h-4',
                index === lines - 1 && 'w-3/4'
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Stats card skeleton
export function StatsCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-card text-card-foreground shadow-sm p-6', className)}>
      <div className="flex items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  )
}

// List skeleton
export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex items-center space-x-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-3 w-[150px]" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Form skeleton
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <div className="flex justify-end space-x-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}

// Chart skeleton
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-card text-card-foreground shadow-sm p-6', className)}>
      <div className="flex items-center justify-between space-y-0 pb-4">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="h-[200px] flex items-end justify-around">
        {Array.from({ length: 12 }).map((_, index) => (
          <Skeleton
            key={index}
            className="w-full max-w-[40px]"
            style={{ height: `${Math.random() * 100 + 50}px` }}
          />
        ))}
      </div>
    </div>
  )
}

// Dashboard skeleton
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatsCardSkeleton key={index} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      {/* Recent activity */}
      <CardSkeleton hasHeader lines={5} />
    </div>
  )
}

export { Skeleton }
