import { Skeleton, SkeletonCard } from './Skeleton';

export function TeamUserSkeleton() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Stats cards skeleton */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="p-4">
            <Skeleton className="mb-2 h-8 w-12" />
            <Skeleton className="h-3 w-20" />
          </SkeletonCard>
        ))}
      </div>

      {/* Activity table skeleton */}
      <SkeletonCard>
        <div className="mb-4">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border pb-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}
