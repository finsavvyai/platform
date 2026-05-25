import { Skeleton, SkeletonCard } from './Skeleton';

export function AgentsSkeleton() {
  return (
    <div>
      {/* Score card skeleton */}
      <SkeletonCard className="mb-6 flex items-center gap-8">
        <Skeleton className="h-12 w-20" />
        <div className="flex-1">
          <Skeleton className="mb-2 h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-24" />
      </SkeletonCard>

      {/* Stat grid skeleton */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} className="p-4">
            <Skeleton className="mb-2 h-8 w-12" />
            <Skeleton className="h-3 w-16" />
          </SkeletonCard>
        ))}
      </div>

      {/* Risk distribution skeleton */}
      <SkeletonCard>
        <Skeleton className="mb-4 h-4 w-32" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-2 flex-1" />
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}
