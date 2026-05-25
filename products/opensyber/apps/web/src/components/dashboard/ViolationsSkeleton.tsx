import { Skeleton, SkeletonCard } from './Skeleton';

export function ViolationsSkeleton() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="mb-8">
        <Skeleton className="mb-2 h-9 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Filters skeleton */}
      <div className="mb-6 flex flex-wrap gap-3">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Violations list skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="mb-2 h-5 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8" />
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}
