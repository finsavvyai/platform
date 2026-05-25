import { Skeleton, SkeletonCard } from './Skeleton';

export function TeamSkeleton() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="mb-8">
        <Skeleton className="mb-2 h-9 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Score card skeleton */}
      <SkeletonCard className="mb-6 flex items-center gap-8">
        <div className="text-center">
          <Skeleton className="mb-1 h-12 w-20" />
          <Skeleton className="h-7 w-16" />
        </div>
        <div className="flex-1">
          <Skeleton className="mb-1 h-4 w-40" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-8 w-8" />
      </SkeletonCard>

      {/* Stats grid skeleton */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} className="p-4">
            <Skeleton className="mb-2 h-8 w-12" />
            <Skeleton className="h-3 w-20" />
          </SkeletonCard>
        ))}
      </div>

      {/* Members table skeleton */}
      <div className="overflow-x-auto rounded border border-border bg-panel/30">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-secondary">
              {Array.from({ length: 5 }).map((_, i) => (
                <th key={i} className="px-6 py-3">
                  <Skeleton className="h-4 w-24" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {Array.from({ length: 3 }).map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-3"><Skeleton className="h-4 w-32" /></td>
                <td className="px-6 py-3"><Skeleton className="h-8 w-20" /></td>
                <td className="px-6 py-3"><Skeleton className="h-4 w-16" /></td>
                <td className="px-6 py-3"><Skeleton className="h-4 w-16" /></td>
                <td className="px-6 py-3"><Skeleton className="h-4 w-24" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
